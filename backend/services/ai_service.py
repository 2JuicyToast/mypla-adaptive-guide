"""Provider-neutral service boundary for MyPLA task parsing."""

import re
from difflib import SequenceMatcher
from typing import Any, Protocol

from pydantic import ValidationError

from backend.models import EnergyLevel, Priority, TaskCreate
from backend.services.ai_diagnostics import log_ai_parse_metadata
from backend.services.ai_errors import InvalidTaskDraftError
from backend.services.openrouter_task_parser import OpenRouterTaskParser


_CONVERSATIONAL_PREFIX = re.compile(
    r"^(?:(?:can|could|would)\s+you\s+help\s+me(?:\s+to)?|"
    r"(?:i|we)\s+(?:need|have|should|want|would like)\s+to|"
    r"(?:i|we)\s+(?:have|got)\s+(?:a|an|the|my|some)|please)\s+",
    re.IGNORECASE,
)
_TASK_WRAPPER = re.compile(r"^(?:finish|complete|do)\s+(?:(?:my|the|a|an|some)\s+)?", re.I)
_DEADLINE = re.compile(
    r"\b(?:due(?:\s+on)?|by|before|no later than)\s+"
    r"(?:(?:this|next|coming)\s+)?"
    r"(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
    r"today|tomorrow|(?:this|next)\s+week|the end of (?:the )?week|weekend|"
    r"january|february|march|april|may|june|july|august|september|october|"
    r"november|december|\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?|"
    r"\d{4}-\d{2}-\d{2})\b",
    re.IGNORECASE,
)
_LOOSE_DEADLINE = re.compile(
    r"\b(?:sometime|anytime)\s+(?:this|next)\s+week\b|\b(?:today|tomorrow)\b",
    re.IGNORECASE,
)
_NOISY_TAIL = re.compile(
    r"(?:[,;]\s*|\s+and\s+)"
    r"(?:(?:it|this|that)\s+)?"
    r"(?:(?:probably|maybe|around|about)\s+)?"
    r"(?:(?:will|would|should|might|'ll)\s+)?"
    r"(?:take|takes|taking|is|it's|it is|this is|it'll be|it will be|"
    r"pretty|very|really|high priority|low priority|not urgent)\b.*$",
    re.IGNORECASE,
)


def _text_fingerprint(value: str) -> str:
    return " ".join(re.findall(r"\w+", value.casefold()))


def _is_near_duplicate(value: str, original: str) -> bool:
    normalized = _text_fingerprint(value)
    source = _text_fingerprint(original)
    if not normalized or not source:
        return False
    return normalized == source or (
        min(len(normalized), len(source)) >= 24
        and SequenceMatcher(None, normalized, source).ratio() >= 0.82
    )


def _clean_title(value: str) -> str:
    title = re.split(r"(?<=[.!?])\s+", value.strip(), maxsplit=1)[0]
    title = _CONVERSATIONAL_PREFIX.sub("", title, count=1)
    title = _NOISY_TAIL.sub("", title)
    deadline = _DEADLINE.search(title) or _LOOSE_DEADLINE.search(title)
    if deadline:
        title = title[: deadline.start()]
    title = _TASK_WRAPPER.sub("", title.strip())
    title = re.sub(r"^(?:my|the|a|an|some)\s+", "", title, flags=re.IGNORECASE)
    title = re.sub(r"^[\s:,-]+|[\s:;,.-]+$", "", title).strip()
    return title[:1].upper() + title[1:] if title else ""


def _normalize_draft(parsed: dict[str, Any], original: str) -> dict[str, Any]:
    """Remove obvious conversational copies while preserving model-extracted facts."""
    draft = dict(parsed)
    name = draft.get("name")
    if isinstance(name, str):
        cleaned_name = _clean_title(name)
        needs_normalization = (
            _is_near_duplicate(name, original)
            or bool(_CONVERSATIONAL_PREFIX.match(name))
            or len(name.split()) > 8
            or not cleaned_name
            or _is_near_duplicate(cleaned_name, original)
        )
        if needs_normalization:
            cleaned_name = _clean_title(original)
        draft["name"] = cleaned_name or "New task"

    description = draft.get("description")
    if isinstance(description, str) and (
        not description.strip()
        or _is_near_duplicate(description, original)
        or bool(_CONVERSATIONAL_PREFIX.match(description))
    ):
        draft["description"] = None

    for field in ("course", "category"):
        value = draft.get(field)
        if isinstance(value, str) and (
            _is_near_duplicate(value, original) or bool(_CONVERSATIONAL_PREFIX.match(value))
        ):
            draft[field] = None

    actions = draft.get("actions")
    if isinstance(actions, list):
        normalized_actions = []
        for action in actions:
            if not isinstance(action, dict) or not isinstance(action.get("label"), str):
                normalized_actions.append(action)
                continue
            label = action["label"].strip()
            if _is_near_duplicate(label, original):
                continue
            cleaned_label = _CONVERSATIONAL_PREFIX.sub("", label, count=1).strip()
            if cleaned_label:
                normalized_action = dict(action)
                normalized_action["label"] = cleaned_label[:1].upper() + cleaned_label[1:]
                if isinstance(normalized_action.get("description"), str) and (
                    _is_near_duplicate(normalized_action["description"], original)
                ):
                    normalized_action["description"] = None
                normalized_actions.append(normalized_action)
        draft["actions"] = normalized_actions
    return draft


class TaskParser(Protocol):
    provider_name: str

    def parse(self, text: str) -> dict[str, Any]: ...


class AIService:
    def __init__(self, parser: TaskParser | None = None) -> None:
        self.parser = parser or OpenRouterTaskParser()

    def parse_task(self, text: str) -> dict[str, Any]:
        cleaned = text.strip()
        if not cleaned:
            raise InvalidTaskDraftError("Enter a task description to create a draft.")
        try:
            normalized = _normalize_draft(self.parser.parse(cleaned), cleaned)
            draft = TaskCreate.model_validate(normalized)
        except ValidationError:
            log_ai_parse_metadata(
                getattr(self.parser, "selected_model", self.parser.provider_name),
                schema_validation_failed=True,
            )
            raise InvalidTaskDraftError(
                "MyPLA AI returned an invalid task draft. Try again."
            ) from None
        log_ai_parse_metadata(
            getattr(self.parser, "selected_model", self.parser.provider_name),
            schema_validation_failed=False,
        )
        return {
            "draft": draft,
            "message": "Review or edit this task draft. Nothing is saved until you add it to your plan.",
            "provider": self.parser.provider_name,
        }

    def stuck_response(self) -> dict:
        return {
            "message": "Your note was recorded. No task changes were made.",
            "suggestions": ["break it down", "try another strategy", "switch to a lower-energy task"],
            "provider": "deterministic-placeholder",
        }


def export_for_myrpg(tasks: list[dict]) -> dict:
    """Future export boundary only; this deliberately contains no MyRPG logic."""
    return {
        "activities": [
            {"name": task["name"], "completedAt": task.get("completed_at")}
            for task in tasks
            if task.get("status") == "done"
        ],
        "milestones": [],
        "skills": [],
        "achievements": [],
        "interests": [],
    }