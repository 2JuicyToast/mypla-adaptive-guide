"""Deterministic schedule helpers; suggestions are proposals, not mutations."""

from datetime import date, datetime, time

from backend.database.repository import MemoryRepository, SupabaseRepository
from backend.models import EnergyLevel, ScheduleBlock, Task
from backend.services.priority_engine import PriorityEngine

Repository = MemoryRepository | SupabaseRepository

WEEKDAY_PATTERN = (
    ("Morning routine", "routine", time(7, 30), time(8, 0)),
    ("Commute / transition", "transition", time(8, 0), time(8, 30)),
    ("Class block", "fixed", time(9, 0), time(12, 0)),
    ("Lunch and reset", "break", time(12, 0), time(13, 0)),
    ("Class / campus time", "fixed", time(13, 0), time(15, 0)),
    ("Flexible study time", "flexible", time(15, 30), time(17, 0)),
)


class Scheduler:
    def __init__(self, priority: PriorityEngine | None = None):
        self.priority = priority or PriorityEngine()

    def typical_weekday(self, day: date) -> list[ScheduleBlock]:
        if day.weekday() > 4:
            return []
        return [
            ScheduleBlock(
                id=f"weekday-{day.isoformat()}-{index}",
                title=title,
                kind=kind,
                start=datetime.combine(day, start),
                end=datetime.combine(day, end),
            )
            for index, (title, kind, start, end) in enumerate(WEEKDAY_PATTERN)
        ]

    def recommend(
        self,
        tasks: list[Task],
        available_minutes: int,
        current_energy: EnergyLevel | None = None,
    ) -> list[Task]:
        if available_minutes <= 0:
            return []
        candidates = [
            task for task in tasks
            if task.status != "done" and task.estimated_minutes <= available_minutes
        ]
        return sorted(
            candidates,
            key=lambda task: (
                -self.priority.score(task, current_energy=current_energy).score,
                task.due_date or date.max,
                task.id,
            ),
        )

    def list_day(self, repository: Repository, user_id: str, day: date) -> list[ScheduleBlock]:
        saved = repository.list_schedule(user_id, day)
        return saved or self.typical_weekday(day)