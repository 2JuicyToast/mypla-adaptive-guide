"""OpenRouter adapter for provider-neutral natural-language task parsing."""

from __future__ import annotations

from datetime import date
import json
import os
from typing import Any

import httpx

from backend.services.ai_errors import (
    AIConfigurationError,
    AIProviderUnavailableError,
    AIRateLimitedError,
    IncompleteStructuredOutputError,
    InvalidTaskDraftError,
    MalformedStructuredOutputError,
)
from backend.services.ai_diagnostics import log_ai_parse_metadata

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_OPENROUTER_MODEL = "openrouter/free"

TASK_DRAFT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "name": {
            "type": "string",
            "minLength": 1,
            "maxLength": 240,
            "description": (
                "A concise human-readable task title, normally 2–8 words. Name the central task; "
                "never repeat the full user sentence, conversational request, deadline, duration, "
                "importance, or explanation."
            ),
        },
        "description": {
            "type": ["string", "null"],
            "description": (
                "Brief supporting context not already represented by another structured field. "
                "Use null when no useful context remains; do not copy the full user input."
            ),
        },
        "course": {
            "type": ["string", "null"],
            "description": (
                "The course name or code only when explicitly identified or clearly named by the "
                "user; otherwise null. Never infer a course from unrelated context."
            ),
        },
        "dueDate": {
            "type": ["string", "null"],
            "format": "date",
            "description": (
                "An ISO YYYY-MM-DD deadline supported by the user's text. Resolve relative dates "
                "from today's date and named weekdays to the next occurrence; use null if unclear."
            ),
        },
        "estimatedMinutes": {
            "type": "integer",
            "minimum": 0,
            "maximum": 10080,
            "description": (
                "Estimated duration in minutes. Preserve explicit durations; when omitted, use a "
                "reasonable estimate. Never put the duration in the task name."
            ),
        },
        "priority": {
            "type": "string",
            "enum": ["high", "medium", "low"],
            "description": (
                "Importance only: high when the user explicitly says important (including very, "
                "really, or pretty important) or high priority; low for explicitly low priority/"
                "not urgent; otherwise medium. Do not calculate the final numeric priority score."
            ),
        },
        "energyRequired": {
            "type": "string",
            "enum": ["high", "medium", "low"],
            "description": (
                "Energy or difficulty requirement only when explicitly stated; otherwise medium."
            ),
        },
        "category": {
            "type": ["string", "null"],
            "description": (
                "A normalized task type when clearly expressed (for example Lab, Essay, Quiz, or "
                "Assignment); otherwise null. Do not invent a category."
            ),
        },
        "actions": {
            "type": "array",
            "maxItems": 1,
            "description": (
                "Zero or one useful concrete first step, not a restatement of the user's request. "
                "Use an empty array if no useful first step is supported."
            ),
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "label": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 300,
                        "description": "A short, actionable first step supported by the task details.",
                    },
                    "description": {
                        "type": ["string", "null"],
                        "description": "Optional details for this step; null when none are useful.",
                    },
                    "estimatedMinutes": {
                        "type": ["integer", "null"],
                        "minimum": 0,
                        "description": "Optional step duration in minutes; null if not known.",
                    },
                    "energyRequired": {
                        "type": ["string", "null"],
                        "enum": ["high", "medium", "low", None],
                        "description": "Optional energy level for the step; null if not known.",
                    },
                    "parentActionId": {
                        "type": ["string", "null"],
                        "description": "Always null for this single initial action.",
                    },
                },
                "required": [
                    "label",
                    "description",
                    "estimatedMinutes",
                    "energyRequired",
                    "parentActionId",
                ],
            },
        },
    },
    "required": [
        "name",
        "description",
        "course",
        "dueDate",
        "estimatedMinutes",
        "priority",
        "energyRequired",
        "category",
        "actions",
    ],
}


class OpenRouterTaskParser:
    """Parses only the supplied task text; it never writes MyPLA data."""

    provider_name = "openrouter"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._http_client = http_client or httpx.Client(
            timeout=httpx.Timeout(45.0, connect=8.0)
        )

    @property
    def selected_model(self) -> str:
        return (
            self._model
            or os.getenv("OPENROUTER_MODEL")
            or DEFAULT_OPENROUTER_MODEL
        ).strip()

    def parse(self, text: str) -> dict[str, Any]:
        api_key = (
            self._api_key
            if self._api_key is not None
            else os.getenv("OPENROUTER_API_KEY", "")
        ).strip()
        if not api_key:
            raise AIConfigurationError(
                "Natural-language task parsing is not configured."
            )

        model = self.selected_model
        today = date.today().isoformat()
        system_prompt = f"""You convert the user's task-intake text into one clear, unsaved MyPLA task draft.
Today's date is {today}. Use it only to resolve deadlines stated in the input.

Understand the task and extract its fields; do not copy the whole sentence into the task name or description.
- name: Give a concise title, normally 2–8 words, centered on the task. Remove conversational wording (such as "I need to", "I have to", "I should", or "Can you help me"), deadlines, duration, importance, and extra explanation. Examples: "I need to finish my physics lab by Thursday" → "Physics lab"; "I have to study chapters 4 through 6 for biology" → "Study biology chapters 4–6"; "I need to write my English essay before Friday" → "English essay".
- description: Include only useful supporting context left over after filling structured fields. Use null when none remains. Never repeat the full input.
- course: Include a course only when the user explicitly identifies or clearly names it (for example "Physics" or "STAT 210"). "Homework for class" does not identify a course.
- category: Use a normalized task type only when clear, such as Lab, Essay, Quiz, or Assignment. Otherwise return null.
- dueDate: Return an ISO date for a stated deadline. Resolve relative dates from today's date. A named weekday is the next occurrence of that weekday. Return null when the date is genuinely unclear; do not put the deadline in the name.
- estimatedMinutes: Preserve explicit durations (two hours = 120; 45 minutes = 45). If omitted, estimate a reasonable duration, including for phrases like "all afternoon". Do not put duration in the name.
- priority: This is an importance input only. Use high for an explicit "important" or "high priority" statement (including "very/really/pretty important"), low for "low priority" or "not urgent", and medium when unclear. Do not calculate a numeric score.
- energyRequired: Extract high or low only when the user explicitly indicates the energy or difficulty required; otherwise use medium.
- actions: Return at most one concise, useful first step when the input supports one. It must not repeat the user's whole request. Examples: a physics lab → "Review the lab instructions"; an essay → "Open the essay prompt"; studying for a quiz → "Review the study material". Return an empty array when there is not enough context for a useful first step.

Do not invent a course, deadline, task type, or other factual detail. The submitted text is the only task context: do not request or infer account data. Do not create a plan or modify/save anything. Return only the requested structured fields; do not include private reasoning."""
        request_body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "mypla_task_draft",
                    "strict": True,
                    "schema": TASK_DRAFT_SCHEMA,
                },
            },
            "provider": {"require_parameters": True},
            "reasoning": {"effort": "minimal", "exclude": True},
            "max_tokens": 4096,
            "temperature": 0.1,
        }

        for attempt in range(2):
            try:
                return self._request_draft(api_key, model, request_body)
            except IncompleteStructuredOutputError:
                if attempt == 1:
                    raise
        raise IncompleteStructuredOutputError(
            "MyPLA AI received an incomplete response. Try again."
        )

    def _request_draft(
        self, api_key: str, model: str, request_body: dict[str, Any]
    ) -> dict[str, Any]:
        try:
            response = self._http_client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            log_ai_parse_metadata(model, http_status=status)
            if status == 429:
                raise AIRateLimitedError(
                    "MyPLA AI is temporarily rate limited. Try again shortly."
                ) from None
            raise AIProviderUnavailableError(
                "MyPLA AI is temporarily unavailable."
            ) from None
        except httpx.HTTPError:
            log_ai_parse_metadata(model)
            raise AIProviderUnavailableError(
                "MyPLA AI is temporarily unavailable."
            ) from None

        try:
            result = response.json()
        except ValueError:
            log_ai_parse_metadata(
                model, http_status=response.status_code, json_decode_failed=True
            )
            raise MalformedStructuredOutputError(
                "MyPLA AI returned an invalid task draft. Try again."
            ) from None

        choices = result.get("choices") if isinstance(result, dict) else None
        choice = choices[0] if isinstance(choices, list) and choices else None
        message = choice.get("message") if isinstance(choice, dict) else None
        finish_reason = choice.get("finish_reason") if isinstance(choice, dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        content_empty = not isinstance(content, str) or not content.strip()
        log_kwargs = {
            "http_status": response.status_code,
            "finish_reason": finish_reason,
            "content_empty": content_empty,
        }

        if finish_reason in ("length", "incomplete") or content_empty:
            log_ai_parse_metadata(model, **log_kwargs)
            raise IncompleteStructuredOutputError(
                "MyPLA AI received an incomplete response. Try again."
            )
        if finish_reason not in (None, "stop"):
            log_ai_parse_metadata(model, **log_kwargs)
            raise IncompleteStructuredOutputError(
                "MyPLA AI received an incomplete response. Try again."
            )

        try:
            draft = json.loads(content)
        except json.JSONDecodeError:
            log_ai_parse_metadata(
                model,
                **log_kwargs,
                json_decode_failed=True,
            )
            raise MalformedStructuredOutputError(
                "MyPLA AI returned an invalid task draft. Try again."
            ) from None

        if not isinstance(draft, dict):
            log_ai_parse_metadata(
                model,
                **log_kwargs,
                json_decode_failed=False,
                schema_validation_failed=True,
            )
            raise InvalidTaskDraftError(
                "MyPLA AI returned an invalid task draft. Try again."
            )

        log_ai_parse_metadata(model, **log_kwargs, json_decode_failed=False)
        return draft