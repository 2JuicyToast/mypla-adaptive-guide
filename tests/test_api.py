import pytest
from fastapi.testclient import TestClient

import backend.main as main
from backend.database.repository import MemoryRepository
from backend.main import RequestContext, app, get_context
from backend.models import TaskCreate
from backend.services.ai_errors import (
    AIConfigurationError,
    AIProviderUnavailableError,
    AIRateLimitedError,
    IncompleteStructuredOutputError,
    InvalidTaskDraftError,
    MalformedStructuredOutputError,
)


@pytest.fixture
def client():
    repository = MemoryRepository(seed_demo_data=True)
    app.dependency_overrides[get_context] = lambda: RequestContext(
        repository, "demo-user", "memory"
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_health_discloses_non_persistent_development_storage(client, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_PUBLISHABLE_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["storageMode"] == "memory"
    assert response.json()["persistent"] is False
    assert response.json()["supabaseConfigured"] is False
    assert response.json()["openRouterConfigured"] is False


def test_health_and_public_client_config_read_supabase_configuration(client, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://mypla-test.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-only-openrouter-secret")

    health = client.get("/api/health")
    config = client.get("/api/client-config")

    assert health.status_code == 200
    assert health.json()["supabaseConfigured"] is True
    assert health.json()["storageMode"] == "supabase"
    assert health.json()["persistent"] is True
    assert health.json()["openRouterConfigured"] is True
    assert "test-only-openrouter-secret" not in health.text
    assert "SUPABASE_URL" not in health.text
    assert "SUPABASE_PUBLISHABLE_KEY" not in health.text
    assert config.status_code == 200
    assert config.json() == {
        "enabled": True,
        "url": "https://mypla-test.supabase.co",
        "publishableKey": "sb_publishable_test",
    }


def test_partial_supabase_configuration_fails_clearly(client, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://mypla-test.supabase.co")
    monkeypatch.delenv("SUPABASE_PUBLISHABLE_KEY", raising=False)

    response = client.get("/api/client-config")

    assert response.status_code == 503
    assert "Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY" in response.json()["detail"]


def test_task_api_completes_actions_in_order_before_completing_task(client):
    created = client.post(
        "/api/tasks",
        json={
            "name": "Draft lab notes",
            "estimatedMinutes": 25,
            "priority": "medium",
            "energyRequired": "low",
            "actions": [{"label": "Open the notebook"}, {"label": "Write a first line"}],
        },
    )
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["actions"][0]["label"] == "Open the notebook"
    assert client.get(f"/api/tasks/{task['id']}/next-action").json()["label"] == "Open the notebook"

    blocked = client.post(f"/api/tasks/{task['id']}/complete")
    assert blocked.status_code == 409
    blocked_patch = client.patch(f"/api/tasks/{task['id']}", json={"status": "done"})
    assert blocked_patch.status_code == 409

    first = client.post(f"/api/tasks/{task['id']}/actions/{task['actions'][0]['id']}/complete")
    assert first.status_code == 200
    assert first.json()["actions"][0]["done"] is True
    assert first.json()["actions"][1]["done"] is False
    assert client.get(f"/api/tasks/{task['id']}/next-action").json()["label"] == "Write a first line"

    second = client.post(f"/api/tasks/{task['id']}/actions/{task['actions'][1]['id']}/complete")
    assert second.status_code == 200
    assert second.json()["actions"][1]["done"] is True
    assert client.get(f"/api/tasks/{task['id']}/next-action").json() is None

    completed = client.post(f"/api/tasks/{task['id']}/complete")
    assert completed.status_code == 200
    assert completed.json()["status"] == "done"


def test_task_delete_removes_only_the_requested_user_task(client):
    created = client.post(
        "/api/tasks",
        json={"name": "Remove this task", "estimatedMinutes": 10},
    )
    task_id = created.json()["id"]
    deleted = client.delete(f"/api/tasks/{task_id}")
    assert deleted.status_code == 204
    assert all(task["id"] != task_id for task in client.get("/api/tasks").json())


def test_natural_language_endpoint_returns_an_unsaved_draft_and_python_scores_after_confirmation(
    client, monkeypatch
):
    before = len(client.get("/api/tasks").json())
    draft = TaskCreate(
        name="Prepare my biology notes",
        course="Biology",
        priority="high",
        estimatedMinutes=45,
    )
    monkeypatch.setattr(
        main.ai_service,
        "parse_task",
        lambda text: {
            "draft": draft,
            "message": "Review or edit this task draft.",
            "provider": "test-parser",
        },
    )

    response = client.post("/api/tasks/parse", json={"text": "Prepare my biology notes"})

    assert response.status_code == 200
    assert response.json()["saved"] is False
    assert response.json()["provider"] == "test-parser"
    assert response.json()["draft"]["name"] == draft.name
    assert "priorityScore" not in response.json()["draft"]
    assert len(client.get("/api/tasks").json()) == before

    confirmed = client.post("/api/tasks", json=response.json()["draft"])
    assert confirmed.status_code == 201, confirmed.text
    assert confirmed.json()["priorityScore"] > 0
    assert "importance: high" in confirmed.json()["priorityExplanation"]


def test_natural_language_endpoint_returns_a_safe_error_when_provider_is_unavailable(
    client, monkeypatch
):
    def unavailable(_text):
        raise AIProviderUnavailableError("provider unavailable")

    monkeypatch.setattr(main.ai_service, "parse_task", unavailable)
    response = client.post("/api/tasks/parse", json={"text": "A synthetic test task"})

    assert response.status_code == 503
    assert "Your task was not saved" in response.json()["detail"]


def test_natural_language_endpoint_explains_missing_provider_configuration(
    client, monkeypatch
):
    def not_configured(_text):
        raise AIConfigurationError("configuration diagnostic")

    monkeypatch.setattr(main.ai_service, "parse_task", not_configured)

    response = client.post("/api/tasks/parse", json={"text": "A synthetic test task"})

    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]
    assert "guided task entry" in response.json()["detail"]
    assert "configuration diagnostic" not in response.text


def test_natural_language_endpoint_distinguishes_rate_limits_safely(client, monkeypatch):
    def rate_limited(_text):
        raise AIRateLimitedError("upstream rate-limit diagnostics")

    monkeypatch.setattr(main.ai_service, "parse_task", rate_limited)

    response = client.post("/api/tasks/parse", json={"text": "A synthetic test task"})

    assert response.status_code == 429
    assert "rate limited" in response.json()["detail"]
    assert "upstream rate-limit diagnostics" not in response.text
    assert "Your task was not saved" in response.json()["detail"]


@pytest.mark.parametrize(
    ("error", "status", "message"),
    [
        (
            IncompleteStructuredOutputError("private completion fragment"),
            502,
            "MyPLA AI received an incomplete response. Try again.",
        ),
        (
            MalformedStructuredOutputError("private malformed content"),
            422,
            "MyPLA AI returned an invalid task draft. Try again.",
        ),
        (
            InvalidTaskDraftError("private schema details"),
            422,
            "MyPLA AI returned an invalid task draft. Try again.",
        ),
    ],
)
def test_natural_language_endpoint_returns_specific_safe_draft_errors_without_saving(
    client, monkeypatch, error, status, message
):
    before = len(client.get("/api/tasks").json())

    def fail_parse(_text):
        raise error

    monkeypatch.setattr(main.ai_service, "parse_task", fail_parse)

    response = client.post("/api/tasks/parse", json={"text": "A synthetic test task"})

    assert response.status_code == status
    assert response.json()["detail"] == message
    assert len(client.get("/api/tasks").json()) == before


def test_natural_language_endpoint_requires_supabase_auth_when_persistence_is_enabled(
    monkeypatch,
):
    monkeypatch.setenv("SUPABASE_URL", "https://mypla-test.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    prior_overrides = app.dependency_overrides.copy()
    app.dependency_overrides.clear()
    try:
        with TestClient(app) as unauthenticated:
            response = unauthenticated.post(
                "/api/tasks/parse", json={"text": "A synthetic test task"}
            )
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prior_overrides)

    assert response.status_code == 401


def test_proposal_rejection_does_not_create_task_and_approval_does(client):
    rejected = client.post(
        "/api/proposals",
        json={
            "kind": "new-task",
            "title": "Maybe add a reading",
            "proposedChanges": {"task": {"name": "Rejected reading"}},
        },
    )
    approved = client.post(
        "/api/proposals",
        json={
            "kind": "new-task",
            "title": "Add a reading",
            "proposedChanges": {"task": {"name": "Approved reading"}},
        },
    )
    assert rejected.status_code == 201
    assert approved.status_code == 201
    assert client.post(f"/api/proposals/{rejected.json()['id']}/reject").status_code == 200
    assert client.post(f"/api/proposals/{approved.json()['id']}/approve").status_code == 200
    task_names = [task["name"] for task in client.get("/api/tasks").json()]
    assert "Approved reading" in task_names
    assert "Rejected reading" not in task_names


def test_adjusted_proposal_commits_only_the_user_edited_task(client):
    before = {task["name"] for task in client.get("/api/tasks").json()}
    proposal = client.post(
        "/api/proposals",
        json={
            "kind": "new-task",
            "title": "Add a study task",
            "proposedChanges": {"task": {"name": "Original title"}},
        },
    ).json()

    adjusted = client.post(
        f"/api/proposals/{proposal['id']}/adjust",
        json={"changes": {"task": {"name": "Edited title", "estimatedMinutes": 25}}},
    )

    assert adjusted.status_code == 200, adjusted.text
    assert adjusted.json()["status"] == "edited"
    after = {task["name"] for task in client.get("/api/tasks").json()}
    assert "Edited title" in after - before
    assert "Original title" not in after


def test_uncommittable_proposal_stays_pending_instead_of_claiming_success(client):
    proposal = client.post(
        "/api/proposals",
        json={"kind": "task-breakdown", "title": "Break down a task"},
    ).json()

    response = client.post(f"/api/proposals/{proposal['id']}/approve")

    assert response.status_code == 422
    current = client.get("/api/proposals").json()
    assert next(item for item in current if item["id"] == proposal["id"])["status"] == "pending"


def test_task_change_proposal_applies_a_validated_patch(client):
    task = client.post("/api/tasks", json={"name": "Draft essay"}).json()
    proposal = client.post(
        "/api/proposals",
        json={
            "kind": "reschedule",
            "title": "Update the task",
            "relatedTaskId": task["id"],
            "proposedChanges": {"taskPatch": {"name": "Draft essay introduction"}},
        },
    ).json()

    response = client.post(f"/api/proposals/{proposal['id']}/approve")

    assert response.status_code == 200, response.text
    assert client.get(f"/api/tasks/{task['id']}").json()["name"] == "Draft essay introduction"


def test_assumption_correction_is_saved_and_schedule_suggestion_is_a_proposal(client):
    answer = client.post(
        "/api/assumptions/a1/response",
        json={"answer": "no", "correction": "Evenings work better for me."},
    )
    assert answer.status_code == 200
    assert answer.json()["userCorrection"] == "Evenings work better for me."
    assert answer.json()["confidence"] == "confirmed"

    schedule = client.post("/api/schedule/suggestions", json={"minutes": 45, "energy": "medium"})
    assert schedule.status_code == 201
    assert schedule.json()["status"] == "pending"
    approved = client.post(f"/api/proposals/{schedule.json()['id']}/approve")
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    blocks = client.get("/api/schedule").json()
    assert any(
        block["taskId"] == schedule.json()["relatedTaskId"] and block["kind"] == "flexible"
        for block in blocks
    )


def test_resource_and_weekly_reflection_are_saved_and_week_is_updated(client):
    resource = client.post(
        "/api/resources",
        json={"name": "Essay outline", "purpose": "Plan a paper before drafting"},
    )
    assert resource.status_code == 201
    assert resource.json()["userId"] == "demo-user"
    assert client.get("/api/resources").json()[0]["name"] == "Essay outline"

    first = client.post(
        "/api/reflections",
        json={"week": "2026-09-28", "challenges": "Hard to begin"},
    )
    second = client.post(
        "/api/reflections",
        json={
            "week": "2026-09-28",
            "challenges": "Started with an outline",
            "whatWentWell": "Finished the reading",
            "helpfulStrategies": "Used a 20-minute timer",
            "thingsToRemember": "Start with the smallest step",
        },
    )
    assert first.status_code == 201
    assert second.status_code == 201
    reflections = client.get("/api/reflections").json()
    assert len(reflections) == 1
    assert reflections[0]["id"] == first.json()["id"]
    assert reflections[0]["challenges"] == "Started with an outline"
    assert reflections[0]["whatWentWell"] == "Finished the reading"
    assert reflections[0]["helpfulStrategies"] == "Used a 20-minute timer"
    assert reflections[0]["thingsToRemember"] == "Start with the smallest step"