"""Provider-neutral validation for flat MyPLA task breakdowns."""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from backend.models import EnergyLevel, Task


class InvalidTaskBreakdownError(Exception):
    """The provider returned a breakdown that cannot be safely proposed."""


class TaskBreakdownAction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        str_strip_whitespace=True,
        use_enum_values=True,
    )

    label: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=1000)
    estimated_minutes: int | None = Field(
        default=None, ge=1, le=1440, alias="estimatedMinutes"
    )
    energy_required: EnergyLevel | None = Field(default=None, alias="energyRequired")


class TaskBreakdown(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        str_strip_whitespace=True,
        use_enum_values=True,
    )

    actions: list[TaskBreakdownAction] = Field(min_length=1, max_length=20)


def _fingerprint(value: str) -> str:
    return " ".join(re.findall(r"\w+", value.casefold()))


def validate_task_breakdown(value: Any, task: Task) -> TaskBreakdown:
    """Validate structure and reject repeated or already-completed work."""
    try:
        breakdown = TaskBreakdown.model_validate(value)
    except ValidationError as exc:
        raise InvalidTaskBreakdownError(
            "MyPLA AI returned an invalid task breakdown. Try again."
        ) from exc

    task_label = _fingerprint(task.name)
    completed_labels = {
        _fingerprint(action.label) for action in task.actions if action.done
    }
    seen: set[str] = set()

    for action in breakdown.actions:
        label = _fingerprint(action.label)
        if not label or label == task_label or label in completed_labels or label in seen:
            raise InvalidTaskBreakdownError(
                "MyPLA AI returned an invalid task breakdown. Try again."
            )
        seen.add(label)

    return breakdown