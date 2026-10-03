"""Task lifecycle operations, kept separate from storage and scoring."""

from datetime import date, datetime, timezone

from fastapi import HTTPException

from backend.database.repository import MemoryRepository, SupabaseRepository
from backend.models import Task, TaskAction, TaskCreate, TaskPatch, TaskStatus, utc_now
from backend.services.priority_engine import PriorityEngine
from backend.services.task_breakdown import TaskBreakdownAction

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
        if any(not action.done for action in task.actions):
            raise HTTPException(
                status_code=409,
                detail="Complete all task actions before completing this task.",
            )
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

    def apply_task_breakdown(
        self, task_id: str, actions: list[TaskBreakdownAction]
    ) -> Task:
        """Replace only unfinished actions while retaining completed records unchanged."""
        task = self.find_task(task_id)
        if task.status == TaskStatus.DONE:
            raise HTTPException(
                status_code=409,
                detail="A completed task cannot be broken down.",
            )
        if not actions:
            raise HTTPException(
                status_code=422,
                detail="A task breakdown must include at least one action.",
            )

        updated_task = task.model_copy(deep=True)
        ordered_actions = sorted(
            updated_task.actions, key=lambda action: action.position
        )
        completed_actions = [action for action in ordered_actions if action.done]
        next_position = max(
            (action.position for action in updated_task.actions),
            default=-1,
        ) + 1
        proposed_actions = [
            TaskAction(
                label=action.label,
                description=action.description,
                estimatedMinutes=action.estimated_minutes,
                energyRequired=action.energy_required,
                position=next_position + index,
                parentActionId=None,
            )
            for index, action in enumerate(actions)
        ]
        updated_task.actions = [*completed_actions, *proposed_actions]
        return self.repository.save_task(updated_task)

    def reorder_tasks(self, ordered_ids: list[str]) -> list[Task]:
        tasks = [self.find_task(task_id) for task_id in ordered_ids]
        for position, task in enumerate(tasks):
            task.position = position
            self.repository.save_task(task)
        return tasks

    def update_task(self, task_id: str, patch: TaskPatch) -> Task:
        task = self.find_task(task_id)
        replaces_actions = patch.actions is not None and bool(patch.actions)
        if patch.status == TaskStatus.DONE and (
            replaces_actions or any(not action.done for action in task.actions)
        ):
            raise HTTPException(
                status_code=409,
                detail="Complete all task actions before completing this task.",
            )
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