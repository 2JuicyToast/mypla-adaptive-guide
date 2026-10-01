"""Provider-neutral service boundary for MyPLA task parsing."""

from typing import Any, Protocol

from pydantic import ValidationError

from backend.models import EnergyLevel, Priority, TaskCreate
from backend.services.ai_errors import InvalidTaskDraftError
from backend.services.openrouter_task_parser import OpenRouterTaskParser


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
            draft = TaskCreate.model_validate(self.parser.parse(cleaned))
        except ValidationError as exc:
            raise InvalidTaskDraftError(
                "MyPLA could not validate the task draft. Try making the task details clearer."
            ) from exc
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