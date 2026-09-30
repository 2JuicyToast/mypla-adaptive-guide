"""Task lifecycle operations, kept separate from storage and scoring."""

from datetime import date, datetime, timezone

from fastapi import HTTPException

from backend.database.repository import MemoryRepository, SupabaseRepository
from backend.models import Task, TaskCreate, TaskPatch, TaskStatus, utc_now
from backend.services.priority_engine import PriorityEngine

Repository = MemoryRepository | SupabaseRepository


class TaskManager:
    def __init__(self, repository: Repository, user_id: str, priority: PriorityEngine | None = None):
        self.repository = repository
        self.user_id = user_id
        self.priority = priority or PriorityEngine()

    def add_task(self, data: TaskCreate) -> Task:
        task = Task(
            **data.model_dump(exclude={"actions"}),
            user_id=self.user_id,
            actions=[
                {
                    **action.model_dump(),
                    "position": position,
                }
                for position, action in enumerate(data.actions)
            ],
        )
        self.priority.apply(task)
        return self.repository.save_task(task)

    def remove_task(self, task_id: str) -> None:
        self.find_task(task_id)
        self.repository.delete_task(self.user_id, task_id)

    def find_task(self, task_id: str) -> Task:
        task = self.repository.get_task(self.user_id, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found.")
        return task

    def complete_task(self, task_id: str) -> Task:
        task = self.find_task(task_id)
        task.status = TaskStatus.DONE
        task.completed_at = utc_now()
        return self.repository.save_task(task)

    def complete_action(self, task_id: str, action_id: str) -> Task:
        task = self.find_task(task_id)
        action = next((item for item in task.actions if item.id == action_id), None)
        if not action:
            raise HTTPException(status_code=404, detail="Task action not found.")
        action.done = True
        return self.repository.save_task(task)

    def get_current_tasks(self) -> list[Task]:
        return self.repository.list_tasks(self.user_id, TaskStatus.CURRENT.value)

    def get_upcoming_tasks(self) -> list[Task]:
        return self.repository.list_tasks(self.user_id, TaskStatus.UPCOMING.value)

    def get_explore_tasks(self) -> list[Task]:
        return self.repository.list_tasks(self.user_id, TaskStatus.EXPLORE.value)

    def get_next_action(self, task_id: str) -> dict | None:
        task = self.find_task(task_id)
        return next((action.model_dump(by_alias=True) for action in task.actions if not action.done), None)

    def reorder_tasks(self, ordered_ids: list[str]) -> list[Task]:
        tasks = [self.find_task(task_id) for task_id in ordered_ids]
        for position, task in enumerate(tasks):
            task.position = position
            self.repository.save_task(task)
        return tasks

    def update_task(self, task_id: str, patch: TaskPatch) -> Task:
        task = self.find_task(task_id)
        updates = patch.model_dump(exclude_unset=True)
        for key, value in updates.items():
            if key == "actions" and value is not None:
                task.actions = [
                    action.model_validate({**item, "position": index})
                    for index, item in enumerate(value)
                ]
            elif value is not None:
                setattr(task, key, value)
        if task.status == TaskStatus.DONE and task.completed_at is None:
            task.completed_at = datetime.now(timezone.utc)
        self.priority.apply(task)
        return self.repository.save_task(task)