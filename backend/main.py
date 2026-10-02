"""FastAPI application for the MyPLA planning foundation."""

from __future__ import annotations

from datetime import date, datetime, timedelta
import os
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.database.repository import repository_for_request
from backend.models import (
    Assumption,
    AssumptionResponse,
    Proposal,
    ProposalCreate,
    Reflection,
    Resource,
    ScheduleBlock,
    ScheduleSuggestion,
    StuckSubmission,
    Task,
    TaskCreate,
    TaskPatch,
    utc_now,
)
from backend.services.ai_service import AIService, export_for_myrpg
from backend.services.ai_errors import (
    AIConfigurationError,
    AIProviderUnavailableError,
    AIRateLimitedError,
    IncompleteStructuredOutputError,
    InvalidTaskDraftError,
    MalformedStructuredOutputError,
)
from backend.services.assumptions import AssumptionService
from backend.services.priority_engine import PriorityEngine
from backend.services.proposals import ProposalService
from backend.services.scheduler import Scheduler
from backend.services.task_manager import TaskManager

app = FastAPI(
    title="MyPLA API",
    description="Deterministic planning services. Assistant changes require user approval.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RequestContext:
    def __init__(self, repository: Any, user_id: str, storage_mode: str):
        self.repository = repository
        self.user_id = user_id
        self.storage_mode = storage_mode
        self.tasks = TaskManager(repository, user_id)
        self.proposals = ProposalService(repository, user_id, self.tasks)
        self.assumptions = AssumptionService(repository, user_id)


def get_context(authorization: Annotated[str | None, Header()] = None) -> RequestContext:
    repository, user_id, storage_mode = repository_for_request(authorization)
    return RequestContext(repository, user_id, storage_mode)


Context = Annotated[RequestContext, Depends(get_context)]
priority_engine = PriorityEngine()
scheduler = Scheduler(priority_engine)
ai_service = AIService()


@app.get("/health")
def health() -> dict[str, Any]:
    url = os.getenv("SUPABASE_URL")
    publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
    configured = bool(url and publishable_key)
    openrouter_configured = bool(os.getenv("OPENROUTER_API_KEY", "").strip())
    return {
        "status": "ok",
        "service": "mypla-api",
        "storageMode": "supabase" if configured else "memory",
        "persistent": configured,
        "supabaseConfigured": configured,
        "openRouterConfigured": openrouter_configured,
        "authentication": "Supabase user token required for Supabase-backed requests",
    }


@app.get("/api/health")
def api_health() -> dict[str, Any]:
    return health()


@app.get("/api/client-config")
def supabase_client_config() -> dict[str, Any]:
    """Provide only the public Supabase client settings needed by browser auth."""
    url = os.getenv("SUPABASE_URL")
    publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not url and not publishable_key:
        return {"enabled": False}
    if not url or not publishable_key:
        raise HTTPException(
            status_code=503,
            detail="Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to enable Supabase auth.",
        )
    return {"enabled": True, "url": url, "publishableKey": publishable_key}


@app.get("/api/tasks", response_model=list[Task])
def list_tasks(
    context: Context,
    status: str | None = Query(default=None),
) -> list[Task]:
    return context.repository.list_tasks(context.user_id, status)


@app.post("/api/tasks", response_model=Task, status_code=201)
def create_task(data: TaskCreate, context: Context) -> Task:
    return context.tasks.add_task(data)


@app.get("/api/tasks/{task_id}", response_model=Task)
def get_task(task_id: str, context: Context) -> Task:
    return context.tasks.find_task(task_id)


@app.patch("/api/tasks/{task_id}", response_model=Task)
def update_task(task_id: str, data: TaskPatch, context: Context) -> Task:
    return context.tasks.update_task(task_id, data)


@app.delete("/api/tasks/{task_id}", status_code=204)
def remove_task(task_id: str, context: Context) -> Response:
    context.tasks.remove_task(task_id)
    return Response(status_code=204)


@app.post("/api/tasks/{task_id}/complete", response_model=Task)
def complete_task(task_id: str, context: Context) -> Task:
    return context.tasks.complete_task(task_id)


@app.post("/api/tasks/{task_id}/actions/{action_id}/complete", response_model=Task)
def complete_action(task_id: str, action_id: str, context: Context) -> Task:
    return context.tasks.complete_action(task_id, action_id)


@app.get("/api/tasks/{task_id}/next-action")
def next_action(task_id: str, context: Context) -> dict | None:
    return context.tasks.get_next_action(task_id)


class ReorderRequest(BaseModel):
    taskIds: list[str] = Field(min_length=1)


class TaskParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@app.post("/api/tasks/reorder", response_model=list[Task])
def reorder_tasks(data: ReorderRequest, context: Context) -> list[Task]:
    return context.tasks.reorder_tasks(data.taskIds)


@app.post("/api/tasks/parse")
def parse_task(payload: TaskParseRequest, context: Context) -> dict[str, Any]:
    """Return an authenticated, validated draft without saving it."""
    try:
        result = ai_service.parse_task(payload.text)
    except AIConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail="Natural-language task parsing is not configured. Use guided task entry instead.",
        ) from exc
    except AIRateLimitedError as exc:
        raise HTTPException(
            status_code=429,
            detail="MyPLA AI is temporarily rate limited. Your task was not saved; try again later or use guided task entry.",
        ) from exc
    except IncompleteStructuredOutputError as exc:
        raise HTTPException(
            status_code=502,
            detail="MyPLA AI received an incomplete response. Try again.",
        ) from exc
    except MalformedStructuredOutputError as exc:
        raise HTTPException(
            status_code=422,
            detail="MyPLA AI returned an invalid task draft. Try again.",
        ) from exc
    except AIProviderUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="MyPLA AI is temporarily unavailable. Your task was not saved; try again or use guided task entry.",
        ) from exc
    except InvalidTaskDraftError as exc:
        raise HTTPException(
            status_code=422,
            detail="MyPLA AI returned an invalid task draft. Try again.",
        ) from exc
    return {
        "draft": result["draft"].model_dump(by_alias=True, mode="json"),
        "message": result["message"],
        "provider": result["provider"],
        "saved": False,
    }


@app.get("/api/proposals", response_model=list[Proposal])
def list_proposals(context: Context) -> list[Proposal]:
    return context.repository.list_proposals(context.user_id)


@app.post("/api/proposals", response_model=Proposal, status_code=201)
def create_proposal(data: ProposalCreate, context: Context) -> Proposal:
    return context.proposals.create(data)


class ProposalDecision(BaseModel):
    changes: dict[str, Any] | None = None


def resolve_proposal(proposal_id: str, decision: str, context: RequestContext, changes: dict | None = None):
    return context.proposals.resolve(proposal_id, decision, changes)


@app.post("/api/proposals/{proposal_id}/approve", response_model=Proposal)
def approve_proposal(proposal_id: str, context: Context) -> Proposal:
    return resolve_proposal(proposal_id, "approve", context)


@app.post("/api/proposals/{proposal_id}/adjust", response_model=Proposal)
def adjust_proposal(proposal_id: str, data: ProposalDecision, context: Context) -> Proposal:
    return resolve_proposal(proposal_id, "adjust", context, data.changes)


@app.post("/api/proposals/{proposal_id}/reject", response_model=Proposal)
def reject_proposal(proposal_id: str, context: Context) -> Proposal:
    return resolve_proposal(proposal_id, "reject", context)


@app.get("/api/assumptions", response_model=list[Assumption])
def list_assumptions(context: Context) -> list[Assumption]:
    return context.repository.list_assumptions(context.user_id)


@app.post("/api/assumptions/{assumption_id}/response", response_model=Assumption)
def respond_to_assumption(
    assumption_id: str,
    response: AssumptionResponse,
    context: Context,
) -> Assumption:
    return context.assumptions.respond(assumption_id, response)


@app.post("/api/stuck")
def submit_stuck_note(payload: StuckSubmission, context: Context) -> dict:
    task = context.tasks.find_task(payload.task_id)
    if payload.action_id and not any(action.id == payload.action_id for action in task.actions):
        raise HTTPException(status_code=404, detail="Task action not found.")
    context.repository.save_stuck_submission(
        {
            "user_id": context.user_id,
            "task_id": payload.task_id,
            "action_id": payload.action_id,
            "reason": payload.reason,
            "detail": payload.detail,
            "created_at": utc_now().isoformat(),
        }
    )
    return ai_service.stuck_response()


@app.get("/api/schedule", response_model=list[ScheduleBlock])
def get_schedule(
    context: Context,
    day: date | None = Query(default=None),
) -> list[ScheduleBlock]:
    return scheduler.list_day(context.repository, context.user_id, day or date.today())


@app.post("/api/schedule/suggestions", response_model=Proposal, status_code=201)
def suggest_schedule(data: ScheduleSuggestion, context: Context) -> Proposal:
    open_tasks = [
        task for task in context.repository.list_tasks(context.user_id)
        if task.status != "done"
    ]
    suggestions = scheduler.recommend(open_tasks, data.minutes, data.energy)
    if not suggestions:
        raise HTTPException(status_code=404, detail="No open task fits that time window.")
    task = suggestions[0]
    start = data.start or datetime.now().replace(second=0, microsecond=0)
    end = start + timedelta(minutes=min(task.estimated_minutes, data.minutes))
    return context.proposals.create(
        ProposalCreate(
            kind="schedule-block",
            title=f"Use {data.minutes} free minutes for {task.name}",
            rationale=f"This task fits your available time and is the strongest deterministic priority match.",
            relatedTaskId=task.id,
            proposedChanges={
                "scheduleBlock": {
                    "taskId": task.id,
                    "title": task.name,
                    "kind": "flexible",
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "status": "planned",
                }
            },
            changes=[],
        )
    )


@app.get("/api/resources", response_model=list[Resource])
def list_resources(context: Context) -> list[Resource]:
    return context.repository.list_resources(context.user_id)


@app.post("/api/resources", response_model=Resource, status_code=201)
def save_resource(resource: Resource, context: Context) -> Resource:
    resource.user_id = context.user_id
    return context.repository.save_resource(resource)


@app.get("/api/reflections", response_model=list[Reflection])
def list_reflections(context: Context) -> list[Reflection]:
    return context.repository.list_reflections(context.user_id)


@app.post("/api/reflections", response_model=Reflection, status_code=201)
def save_reflection(reflection: Reflection, context: Context) -> Reflection:
    reflection.user_id = context.user_id
    return context.repository.save_reflection(reflection)


@app.get("/api/myrpg/export")
def myrpg_export(context: Context) -> dict:
    """Future hand-off shape only; does not implement game or reward mechanics."""
    tasks = [task.model_dump(mode="json", by_alias=False) for task in context.repository.list_tasks(context.user_id)]
    return export_for_myrpg(tasks)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)