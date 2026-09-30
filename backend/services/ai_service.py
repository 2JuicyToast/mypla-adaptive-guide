"""Provider-neutral placeholder: deterministic drafts only, no LLM calls."""

from backend.models import EnergyLevel, Priority, TaskCreate


class AIService:
    def parse_task(self, text: str) -> dict:
        cleaned = text.strip()
        return {
            "draft": TaskCreate(
                name=cleaned[:240],
                priority=Priority.MEDIUM,
                energyRequired=EnergyLevel.MEDIUM,
            ),
            "message": "This is a draft based only on your text. Review it before saving.",
            "provider": "deterministic-placeholder",
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