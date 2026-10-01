"""Repository boundary: deterministic services do not issue Supabase queries."""

from __future__ import annotations

import os
from datetime import date
from typing import Any

from fastapi import HTTPException
from supabase import Client, create_client

from backend.models import (
    Assumption,
    Proposal,
    Reflection,
    Resource,
    ScheduleBlock,
    Task,
    TaskAction,
    utc_now,
)
from backend.services.priority_engine import PriorityEngine


def _task_sort_key(task: Task) -> tuple[int, int, Any, str]:
    """Keep explicit task order, then use deterministic score and stable tie-breakers."""
    return (task.position, -task.priority_score, task.created_at, task.id)


class MemoryRepository:
    """Temporary Replit development store. Data is intentionally not durable."""

    storage_mode = "memory"

    def __init__(self, *, seed_demo_data: bool = False) -> None:
        self.tasks: dict[str, Task] = {}
        self.proposals: dict[str, Proposal] = {}
        self.assumptions: dict[str, Assumption] = {}
        self.schedule_blocks: dict[str, ScheduleBlock] = {}
        self.resources: dict[str, Resource] = {}
        self.reflections: dict[str, Reflection] = {}
        self.stuck_submissions: list[dict[str, Any]] = []
        if seed_demo_data:
            self._seed()

    def _seed(self) -> None:
        examples = [
            Task(
                id="t1",
                name="Statistics problem set 4",
                course="STAT 210",
                priority="high",
                dueDate=date(2026, 10, 2),
                estimatedMinutes=90,
                energyRequired="high",
                status="current",
                assistantNote="Due soon and needs focused time.",
                actions=[
                    TaskAction(id="t1a1", label="Review confidence interval notes", done=True),
                    TaskAction(id="t1a2", label="Work through questions 1–3", estimatedMinutes=40, position=1),
                ],
            ),
            Task(
                id="t2",
                name="Draft intro for research essay",
                course="HIST 145",
                priority="medium",
                dueDate=date(2026, 10, 5),
                estimatedMinutes=45,
                energyRequired="medium",
                status="current",
                assistantNote="A short first step keeps the essay moving.",
                actions=[TaskAction(id="t2a1", label="Pick the three sources to use", estimatedMinutes=15)],
            ),
            Task(
                id="t3",
                name="Lab safety quiz",
                course="CHEM 120",
                priority="low",
                dueDate=date(2026, 10, 1),
                estimatedMinutes=20,
                energyRequired="low",
                status="current",
                assistantNote="A short task for a gap between classes.",
                actions=[TaskAction(id="t3a1", label="Read the safety handout and take the quiz")],
            ),
            Task(
                id="t4",
                name="Group project: slide deck",
                course="BUS 230",
                priority="high",
                dueDate=date(2026, 10, 9),
                estimatedMinutes=120,
                energyRequired="medium",
                status="upcoming",
                actions=[TaskAction(id="t4a1", label="Agree on the section split with your group")],
            ),
            Task(
                id="t5",
                name="Reading: chapters 7–8",
                course="HIST 145",
                priority="medium",
                dueDate=date(2026, 10, 11),
                estimatedMinutes=60,
                energyRequired="low",
                status="upcoming",
                actions=[TaskAction(id="t5a1", label="Read chapter 7 and note two arguments")],
            ),
        ]
        priority = PriorityEngine()
        for task in examples:
            priority.apply(task)
        self.tasks.update({task.id: task for task in examples})
        assumption = Assumption(
            id="a1",
            topic="study_preferences",
            statement="You may prefer to work on writing tasks in the morning.",
            confidence="suggested",
            relatedTaskId="t2",
        )
        self.assumptions[assumption.id] = assumption
        self.schedule_blocks = {
            block.id: block
            for block in [
                ScheduleBlock(
                    id="weekday-2026-09-30-0",
                    title="Morning routine",
                    kind="routine",
                    start="2026-09-30T07:30:00",
                    end="2026-09-30T08:00:00",
                ),
                ScheduleBlock(
                    id="weekday-2026-09-30-1",
                    title="Class block",
                    kind="fixed",
                    start="2026-09-30T09:00:00",
                    end="2026-09-30T12:00:00",
                ),
                ScheduleBlock(
                    id="weekday-2026-09-30-2",
                    title="Flexible study time",
                    kind="flexible",
                    start="2026-09-30T15:30:00",
                    end="2026-09-30T17:00:00",
                ),
            ]
        }

    def list_tasks(self, user_id: str, status: str | None = None) -> list[Task]:
        tasks = [task for task in self.tasks.values() if task.user_id == user_id]
        if status:
            tasks = [task for task in tasks if task.status == status]
        return sorted(tasks, key=_task_sort_key)

    def get_task(self, user_id: str, task_id: str) -> Task | None:
        task = self.tasks.get(task_id)
        return task if task and task.user_id == user_id else None

    def save_task(self, task: Task) -> Task:
        task.updated_at = utc_now()
        self.tasks[task.id] = task
        return task

    def delete_task(self, user_id: str, task_id: str) -> None:
        task = self.get_task(user_id, task_id)
        if task:
            del self.tasks[task_id]

    def list_proposals(self, user_id: str) -> list[Proposal]:
        return [item for item in self.proposals.values() if item.user_id == user_id]

    def get_proposal(self, user_id: str, proposal_id: str) -> Proposal | None:
        proposal = self.proposals.get(proposal_id)
        return proposal if proposal and proposal.user_id == user_id else None

    def save_proposal(self, proposal: Proposal) -> Proposal:
        self.proposals[proposal.id] = proposal
        return proposal

    def list_assumptions(self, user_id: str) -> list[Assumption]:
        return [item for item in self.assumptions.values() if item.user_id == user_id and item.active]

    def get_assumption(self, user_id: str, assumption_id: str) -> Assumption | None:
        item = self.assumptions.get(assumption_id)
        return item if item and item.user_id == user_id else None

    def save_assumption(self, assumption: Assumption) -> Assumption:
        assumption.updated_at = utc_now()
        self.assumptions[assumption.id] = assumption
        return assumption

    def save_stuck_submission(self, submission: dict[str, Any]) -> None:
        self.stuck_submissions.append(submission)

    def list_schedule(self, user_id: str, day: date) -> list[ScheduleBlock]:
        return [
            block
            for block in self.schedule_blocks.values()
            if block.user_id == user_id and block.start.date() == day
        ]

    def save_schedule_block(self, block: ScheduleBlock) -> ScheduleBlock:
        self.schedule_blocks[block.id] = block
        return block

    def list_resources(self, user_id: str) -> list[Resource]:
        return [item for item in self.resources.values() if item.user_id == user_id]

    def save_resource(self, resource: Resource) -> Resource:
        self.resources[resource.id] = resource
        return resource

    def list_reflections(self, user_id: str) -> list[Reflection]:
        return [item for item in self.reflections.values() if item.user_id == user_id]

    def save_reflection(self, reflection: Reflection) -> Reflection:
        existing = next(
            (
                item
                for item in self.reflections.values()
                if item.user_id == reflection.user_id and item.week == reflection.week
            ),
            None,
        )
        if existing:
            reflection.id = existing.id
            reflection.created_at = existing.created_at
        reflection.updated_at = utc_now()
        self.reflections[reflection.id] = reflection
        return reflection


class SupabaseRepository:
    """User-scoped Supabase Data API adapter; database RLS remains authoritative."""

    storage_mode = "supabase"

    def __init__(self, client: Client, user_id: str) -> None:
        self.client = client
        self.user_id = user_id

    def list_tasks(self, user_id: str, status: str | None = None) -> list[Task]:
        query = self.client.table("tasks").select("*, task_actions(*)").eq("user_id", user_id)
        if status:
            query = query.eq("status", status)
        tasks = [self._task_from_row(row) for row in query.execute().data]
        return sorted(tasks, key=_task_sort_key)

    def get_task(self, user_id: str, task_id: str) -> Task | None:
        rows = (
            self.client.table("tasks")
            .select("*, task_actions(*)")
            .eq("id", task_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
        )
        return self._task_from_row(rows[0]) if rows else None

    def save_task(self, task: Task) -> Task:
        row = task.model_dump(mode="json", exclude={"actions"})
        row["importance"] = row.pop("priority")
        self.client.table("tasks").upsert(row).execute()
        action_rows = []
        for action in task.actions:
            action_row = action.model_dump(mode="json", by_alias=False)
            action_row.update(
                task_id=task.id,
                user_id=task.user_id,
                name=action_row.pop("label"),
                status="completed" if action.done else "pending",
            )
            action_row.pop("done", None)
            action_rows.append(action_row)

        # Keep nested actions in sync when an edit removes an action. Upserting
        # the full list together also lets PostgreSQL validate parent links
        # between actions in the same statement.
        existing_rows = (
            self.client.table("task_actions")
            .select("id")
            .eq("task_id", task.id)
            .eq("user_id", task.user_id)
            .execute()
            .data
        )
        action_ids = {row["id"] for row in action_rows}
        if action_rows:
            self.client.table("task_actions").upsert(action_rows).execute()
        removed_ids = [row["id"] for row in existing_rows if row["id"] not in action_ids]
        if removed_ids:
            self.client.table("task_actions").delete().in_("id", removed_ids).eq(
                "task_id", task.id
            ).eq("user_id", task.user_id).execute()
        return task

    def _task_from_row(self, row: dict[str, Any]) -> Task:
        actions = []
        for action in row.pop("task_actions", []) or []:
            action["label"] = action.pop("name")
            action["done"] = action.pop("status") == "completed"
            actions.append(action)
        row["priority"] = row.pop("importance", "medium")
        return Task.model_validate({**row, "actions": actions})

    def delete_task(self, user_id: str, task_id: str) -> None:
        self.client.table("tasks").delete().eq("id", task_id).eq("user_id", user_id).execute()

    def list_proposals(self, user_id: str) -> list[Proposal]:
        rows = self.client.table("proposals").select("*").eq("user_id", user_id).execute().data
        return [self._proposal_from_row(row) for row in rows]

    def get_proposal(self, user_id: str, proposal_id: str) -> Proposal | None:
        rows = (
            self.client.table("proposals")
            .select("*")
            .eq("id", proposal_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
        )
        return self._proposal_from_row(rows[0]) if rows else None

    def save_proposal(self, proposal: Proposal) -> Proposal:
        row = proposal.model_dump(mode="json", by_alias=False)
        row["proposal_type"] = row.pop("kind")
        self.client.table("proposals").upsert(row).execute()
        return proposal

    @staticmethod
    def _proposal_from_row(row: dict[str, Any]) -> Proposal:
        row["kind"] = row.pop("proposal_type")
        return Proposal.model_validate(row)

    def list_assumptions(self, user_id: str) -> list[Assumption]:
        rows = (
            self.client.table("coach_knowledge")
            .select("*")
            .eq("user_id", user_id)
            .eq("active", True)
            .execute()
            .data
        )
        return [self._assumption_from_row(row) for row in rows]

    def get_assumption(self, user_id: str, assumption_id: str) -> Assumption | None:
        rows = (
            self.client.table("coach_knowledge")
            .select("*")
            .eq("id", assumption_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
        )
        return self._assumption_from_row(rows[0]) if rows else None

    def save_assumption(self, assumption: Assumption) -> Assumption:
        row = assumption.model_dump(mode="json", by_alias=False)
        row["statement"] = row.pop("statement")
        self.client.table("coach_knowledge").upsert(row).execute()
        return assumption

    def save_schedule_block(self, block: ScheduleBlock) -> ScheduleBlock:
        self.client.table("schedule_blocks").upsert(
            block.model_dump(mode="json", by_alias=False)
        ).execute()
        return block

    def save_stuck_submission(self, submission: dict[str, Any]) -> None:
        self.client.table("stuck_reports").insert(submission).execute()

    def list_schedule(self, user_id: str, day: date) -> list[ScheduleBlock]:
        start = f"{day.isoformat()}T00:00:00"
        end = f"{day.isoformat()}T23:59:59.999999"
        rows = (
            self.client.table("schedule_blocks")
            .select("*")
            .eq("user_id", user_id)
            .gte("start", start)
            .lte("start", end)
            .order("start")
            .execute()
            .data
        )
        return [ScheduleBlock.model_validate(row) for row in rows]

    def list_resources(self, user_id: str) -> list[Resource]:
        rows = self.client.table("resources").select("*").eq("user_id", user_id).execute().data
        return [Resource.model_validate(row) for row in rows]

    def save_resource(self, resource: Resource) -> Resource:
        self.client.table("resources").upsert(resource.model_dump(mode="json", by_alias=False)).execute()
        return resource

    def list_reflections(self, user_id: str) -> list[Reflection]:
        rows = self.client.table("reflections").select("*").eq("user_id", user_id).execute().data
        return [Reflection.model_validate(row) for row in rows]

    def save_reflection(self, reflection: Reflection) -> Reflection:
        self.client.table("reflections").upsert(
            reflection.model_dump(mode="json", by_alias=False),
            on_conflict="user_id,week",
        ).execute()
        return reflection

    @staticmethod
    def _assumption_from_row(row: dict[str, Any]) -> Assumption:
        return Assumption.model_validate(
            {
                **row,
                "id": row["id"],
                "topic": row.get("topic", "general"),
                "statement": row.get("statement", ""),
                "userCorrection": row.get("user_correction"),
                "relatedTaskId": row.get("related_task_id"),
            }
        )


_memory_repository = MemoryRepository(seed_demo_data=True)


def repository_for_request(authorization: str | None) -> tuple[Any, str, str]:
    """Choose explicit development memory storage or a verified RLS-scoped client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not url and not key:
        return _memory_repository, "demo-user", "memory"
    if not url or not key:
        raise HTTPException(
            status_code=503,
            detail="Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to enable Supabase storage.",
        )
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Supabase storage requires a signed-in user's Bearer access token.",
        )
    token = authorization.split(" ", 1)[1]
    client = create_client(url, key)
    client.postgrest.auth(token)
    try:
        auth_response = client.auth.get_user(token)
        user_id = auth_response.user.id
    except Exception as exc:
        raise HTTPException(status_code=401, detail="The Supabase access token is invalid or expired.") from exc
    return SupabaseRepository(client, user_id), user_id, "supabase"