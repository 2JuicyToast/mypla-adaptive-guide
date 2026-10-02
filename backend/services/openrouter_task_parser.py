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
)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"

TASK_DRAFT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "name": {"type": "string", "minLength": 1, "maxLength": 240},
        "description": {"type": ["string", "null"]},
        "course": {"type": ["string", "null"]},
        "dueDate": {"type": ["string", "null"], "format": "date"},
        "estimatedMinutes": {"type": "integer", "minimum": 0, "maximum": 10080},
        "priority": {"type": "string", "enum": ["high", "medium", "low"]},
        "energyRequired": {"type": "string", "enum": ["high", "medium", "low"]},
        "category": {"type": ["string", "null"]},
        "actions": {
            "type": "array",
            "maxItems": 1,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "label": {"type": "string", "minLength": 1, "maxLength": 300},
                    "description": {"type": ["string", "null"]},
                    "estimatedMinutes": {"type": ["integer", "null"], "minimum": 0},
                    "energyRequired": {
                        "type": ["string", "null"],
                        "enum": ["high", "medium", "low", None],
                    },
                    "parentActionId": {"type": ["string", "null"]},
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

        model = (
            self._model
            or os.getenv("OPENROUTER_MODEL")
            or DEFAULT_OPENROUTER_MODEL
        ).strip()
        today = date.today().isoformat()
        system_prompt = (
            "You create an unsaved MyPLA task draft from the user's task-intake text. "
            f"Today's date is {today}; use it only to resolve clearly stated relative deadlines. "
            "Extract only information explicitly supported by the text. Return null for a course "
            "or category unless it is stated. If a deadline is unclear, return null. A date derived "
            "from a named weekday must fall on that weekday; if unsure, return null. Estimate a "
            "reasonable duration when omitted. Use medium priority and medium energy when importance "
            "or energy is not stated. Priority is only an importance input; do not calculate a "
            "priority score. Add at most one short first action, only when useful. Do not make a "
            "plan, create or modify data, or request or infer account context."
        )
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
            "max_tokens": 8192,
            "temperature": 0.1,
        }

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
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            draft = json.loads(content) if isinstance(content, str) else content
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                raise AIRateLimitedError(
                    "The task parser is temporarily rate limited."
                ) from exc
            raise AIProviderUnavailableError(
                "The task parser is temporarily unavailable. Your task was not saved."
            ) from exc
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
            raise AIProviderUnavailableError(
                "The task parser is temporarily unavailable. Your task was not saved."
            ) from exc

        if not isinstance(draft, dict):
            raise AIProviderUnavailableError(
                "The task parser returned an unreadable draft. Your task was not saved."
            )
        return draft