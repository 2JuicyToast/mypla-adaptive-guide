"""Proposal lifecycle. Proposed changes are applied only by explicit approval."""

from fastapi import HTTPException
from pydantic import ValidationError

from backend.database.repository import MemoryRepository, SupabaseRepository
from backend.models import (
    Proposal,
    ProposalCreate,
    ProposalStatus,
    ScheduleBlock,
    TaskCreate,
    TaskPatch,
    utc_now,
)
from backend.services.task_manager import TaskManager

Repository = MemoryRepository | SupabaseRepository


class ProposalService:
    def __init__(self, repository: Repository, user_id: str, tasks: TaskManager):
        self.repository = repository
        self.user_id = user_id
        self.tasks = tasks

    def create(self, data: ProposalCreate) -> Proposal:
        proposal = Proposal(**data.model_dump(), user_id=self.user_id)
        return self.repository.save_proposal(proposal)

    def resolve(
        self,
        proposal_id: str,
        decision: str,
        adjusted_changes: dict | None = None,
    ) -> Proposal:
        proposal = self.repository.get_proposal(self.user_id, proposal_id)
        if not proposal:
            raise HTTPException(status_code=404, detail="Proposal not found.")
        if proposal.status != ProposalStatus.PENDING:
            raise HTTPException(status_code=409, detail="This proposal has already been resolved.")

        if decision == "reject":
            proposal.status = ProposalStatus.REJECTED
        elif decision in {"approve", "adjust"}:
            if decision == "adjust":
                if adjusted_changes is None:
                    raise HTTPException(status_code=422, detail="Adjusted changes are required.")
                original_changes = proposal.proposed_changes
                proposal.proposed_changes = adjusted_changes
                try:
                    self._commit(proposal)
                except Exception:
                    proposal.proposed_changes = original_changes
                    raise
                proposal.status = ProposalStatus.EDITED
            else:
                self._commit(proposal)
                proposal.status = ProposalStatus.APPROVED
        else:
            raise HTTPException(status_code=422, detail="Decision must be approve, adjust, or reject.")
        proposal.resolved_at = utc_now()
        return self.repository.save_proposal(proposal)

    def _commit(self, proposal: Proposal) -> None:
        changes = proposal.proposed_changes
        if proposal.kind == "new-task":
            payload = changes.get("task")
            if not isinstance(payload, dict):
                raise HTTPException(status_code=422, detail="The proposal does not include a task draft.")
            try:
                task = TaskCreate.model_validate(payload)
            except ValidationError as exc:
                raise HTTPException(status_code=422, detail="The proposed task is invalid.") from exc
            self.tasks.add_task(task)
        elif proposal.kind == "schedule-block":
            block_data = changes.get("scheduleBlock")
            if not isinstance(block_data, dict):
                raise HTTPException(status_code=422, detail="The proposal does not include a schedule block.")
            try:
                block = ScheduleBlock.model_validate({**block_data, "user_id": self.user_id})
            except ValidationError as exc:
                raise HTTPException(status_code=422, detail="The proposed schedule block is invalid.") from exc
            self.repository.save_schedule_block(block)
        elif proposal.kind in {"reschedule", "priority-change", "task-breakdown", "schedule-block"}:
            task_id = proposal.related_task_id or changes.get("taskId")
            patch = changes.get("taskPatch")
            if not task_id or not isinstance(patch, dict):
                raise HTTPException(
                    status_code=422,
                    detail="The proposal does not include a task and supported task changes.",
                )
            try:
                task_patch = TaskPatch.model_validate(patch)
            except ValidationError as exc:
                raise HTTPException(status_code=422, detail="The proposed task changes are invalid.") from exc
            self.tasks.update_task(task_id, task_patch)
        else:
            raise HTTPException(status_code=422, detail=f"Unsupported proposal type: {proposal.kind}.")