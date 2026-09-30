"""Small, readable API/domain models shared by the backend services."""

from __future__ import annotations

from datetime import date, datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def new_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class Priority(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class EnergyLevel(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TaskStatus(StrEnum):
    CURRENT = "current"
    UPCOMING = "upcoming"
    EXPLORE = "explore"
    DONE = "done"


class ActionStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ProposalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    EDITED = "edited"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TaskAction(ApiModel):
    id: str = Field(default_factory=new_id)
    label: str
    description: str | None = None
    done: bool = False
    estimated_minutes: int | None = Field(default=None, ge=0, alias="estimatedMinutes")
    energy_required: EnergyLevel | None = Field(default=None, alias="energyRequired")
    position: int = 0
    parent_action_id: str | None = Field(default=None, alias="parentActionId")


class Task(ApiModel):
    id: str = Field(default_factory=new_id)
    user_id: str = Field(default="demo-user", alias="userId")
    project_id: str | None = Field(default=None, alias="projectId")
    name: str
    description: str | None = None
    course: str | None = None
    status: TaskStatus = TaskStatus.UPCOMING
    due_date: date | None = Field(default=None, alias="dueDate")
    estimated_minutes: int = Field(default=30, ge=0, alias="estimatedMinutes")
    priority: Priority = Priority.MEDIUM
    energy_required: EnergyLevel = Field(default=EnergyLevel.MEDIUM, alias="energyRequired")
    category: str | None = None
    consequences: str | None = None
    is_fixed: bool = Field(default=False, alias="isFixed")
    priority_score: int = Field(default=0, ge=0, le=100, alias="priorityScore")
    priority_explanation: str = Field(default="", alias="priorityExplanation")
    assistant_note: str | None = Field(default=None, alias="assistantNote")
    position: int = 0
    completed_at: datetime | None = Field(default=None, alias="completedAt")
    actions: list[TaskAction] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")
    updated_at: datetime = Field(default_factory=utc_now, alias="updatedAt")


class TaskActionInput(ApiModel):
    label: str = Field(min_length=1, max_length=300)
    description: str | None = None
    estimated_minutes: int | None = Field(default=None, ge=0, alias="estimatedMinutes")
    energy_required: EnergyLevel | None = Field(default=None, alias="energyRequired")
    parent_action_id: str | None = Field(default=None, alias="parentActionId")


class TaskCreate(ApiModel):
    name: str = Field(min_length=1, max_length=240)
    description: str | None = None
    course: str | None = None
    status: TaskStatus = TaskStatus.CURRENT
    due_date: date | None = Field(default=None, alias="dueDate")
    estimated_minutes: int = Field(default=30, ge=0, alias="estimatedMinutes")
    priority: Priority = Priority.MEDIUM
    energy_required: EnergyLevel = Field(default=EnergyLevel.MEDIUM, alias="energyRequired")
    category: str | None = None
    consequences: str | None = None
    is_fixed: bool = Field(default=False, alias="isFixed")
    actions: list[TaskActionInput] = Field(default_factory=list)
    position: int = 0


class TaskPatch(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = None
    course: str | None = None
    status: TaskStatus | None = None
    due_date: date | None = Field(default=None, alias="dueDate")
    estimated_minutes: int | None = Field(default=None, ge=0, alias="estimatedMinutes")
    priority: Priority | None = None
    energy_required: EnergyLevel | None = Field(default=None, alias="energyRequired")
    category: str | None = None
    consequences: str | None = None
    is_fixed: bool | None = Field(default=None, alias="isFixed")
    actions: list[TaskActionInput] | None = None
    position: int | None = None


class PriorityResult(ApiModel):
    score: int = Field(ge=0, le=100)
    explanation: str


class ProposalChange(ApiModel):
    field: str
    before: str = ""
    after: str = ""


class Proposal(ApiModel):
    id: str = Field(default_factory=new_id)
    user_id: str = Field(default="demo-user", alias="userId")
    kind: str
    title: str
    rationale: str
    status: ProposalStatus = ProposalStatus.PENDING
    proposed_changes: dict[str, Any] = Field(default_factory=dict, alias="proposedChanges")
    related_task_id: str | None = Field(default=None, alias="relatedTaskId")
    changes: list[ProposalChange] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")
    resolved_at: datetime | None = Field(default=None, alias="resolvedAt")


class ProposalCreate(ApiModel):
    kind: str
    title: str = Field(min_length=1, max_length=240)
    rationale: str = ""
    proposed_changes: dict[str, Any] = Field(default_factory=dict, alias="proposedChanges")
    related_task_id: str | None = Field(default=None, alias="relatedTaskId")
    changes: list[ProposalChange] = Field(default_factory=list)


class AssumptionAnswer(StrEnum):
    YES = "yes"
    NO = "no"
    NOT_SURE = "not-sure"


class Assumption(ApiModel):
    id: str = Field(default_factory=new_id)
    user_id: str = Field(default="demo-user", alias="userId")
    topic: str
    statement: str
    confidence: str = "suggested"
    source: str = "assistant"
    active: bool = True
    user_correction: str | None = Field(default=None, alias="userCorrection")
    related_task_id: str | None = Field(default=None, alias="relatedTaskId")
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")
    updated_at: datetime = Field(default_factory=utc_now, alias="updatedAt")


class AssumptionResponse(ApiModel):
    answer: AssumptionAnswer
    correction: str | None = None


class StuckSubmission(ApiModel):
    task_id: str = Field(alias="taskId")
    action_id: str | None = Field(default=None, alias="actionId")
    reason: str = Field(min_length=1, max_length=120)
    detail: str | None = Field(default=None, max_length=2000)


class ScheduleBlock(ApiModel):
    id: str = Field(default_factory=new_id)
    user_id: str = Field(default="demo-user", alias="userId")
    task_id: str | None = Field(default=None, alias="taskId")
    title: str
    kind: str
    start: datetime
    end: datetime
    status: str = "planned"
    notes: str | None = None


class ScheduleSuggestion(ApiModel):
    minutes: int = Field(gt=0, le=600)
    energy: EnergyLevel | None = None
    start: datetime | None = None


class Resource(ApiModel):
    id: str = Field(default_factory=new_id)
    user_id: str = Field(default="demo-user", alias="userId")
    name: str
    type: str = "tool"
    url: str | None = None
    purpose: str = ""
    when_useful: str | None = Field(default=None, alias="whenUseful")
    saved_prompt: str | None = Field(default=None, alias="savedPrompt")
    personal_note: str | None = Field(default=None, alias="personalNote")
    tags: list[str] = Field(default_factory=list)


class Reflection(ApiModel):
    id: str = Field(default_factory=new_id)
    user_id: str = Field(default="demo-user", alias="userId")
    week: date
    summary: str = ""
    what_went_well: str = Field(default="", alias="whatWentWell")
    challenges: str = ""
    helpful_strategies: str = Field(default="", alias="helpfulStrategies")
    things_to_remember: str = Field(default="", alias="thingsToRemember")
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")
    updated_at: datetime = Field(default_factory=utc_now, alias="updatedAt")