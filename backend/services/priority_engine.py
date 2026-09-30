"""Deterministic, configurable task priority scoring (never uses an LLM)."""

from datetime import date

from backend.models import EnergyLevel, Priority, PriorityResult, Task

DEADLINE_POINTS = {
    "overdue": 45,
    "today": 45,
    "tomorrow": 40,
    "three_days": 30,
    "seven_days": 20,
    "later": 10,
    "none": 0,
}
IMPORTANCE_POINTS = {Priority.HIGH: 30, Priority.MEDIUM: 20, Priority.LOW: 10}
TIME_POINTS = {"short": 15, "medium": 12, "long": 8, "very_long": 4}
ENERGY_MATCH_POINTS = 10
ENERGY_MISMATCH_POINTS = 3


class PriorityEngine:
    def score(
        self,
        task: Task,
        current_energy: EnergyLevel | None = None,
        today: date | None = None,
    ) -> PriorityResult:
        today = today or date.today()
        if task.due_date is None:
            deadline_band = "none"
        else:
            days = (task.due_date - today).days
            deadline_band = (
                "overdue" if days < 0 else
                "today" if days == 0 else
                "tomorrow" if days == 1 else
                "three_days" if days <= 3 else
                "seven_days" if days <= 7 else
                "later"
            )

        minutes = task.estimated_minutes
        time_band = (
            "short" if minutes <= 30 else
            "medium" if minutes <= 60 else
            "long" if minutes <= 120 else
            "very_long"
        )
        energy_points = (
            ENERGY_MATCH_POINTS
            if current_energy and task.energy_required == current_energy
            else ENERGY_MISMATCH_POINTS
            if current_energy
            else 5
        )
        score = min(
            100,
            DEADLINE_POINTS[deadline_band]
            + IMPORTANCE_POINTS[Priority(task.priority)]
            + TIME_POINTS[time_band]
            + energy_points,
        )
        explanation = (
            f"Deadline: {deadline_band.replace('_', ' ')} "
            f"({DEADLINE_POINTS[deadline_band]} pts); "
            f"importance: {task.priority} ({IMPORTANCE_POINTS[Priority(task.priority)]} pts); "
            f"time: {time_band.replace('_', ' ')} ({TIME_POINTS[time_band]} pts); "
            f"energy fit: {energy_points} pts."
        )
        return PriorityResult(score=score, explanation=explanation)

    def apply(self, task: Task, current_energy: EnergyLevel | None = None) -> Task:
        result = self.score(task, current_energy=current_energy)
        task.priority_score = result.score
        task.priority_explanation = result.explanation
        return task