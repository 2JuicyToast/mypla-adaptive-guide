import pytest
from fastapi.testclient import TestClient

from backend.database.repository import MemoryRepository
from backend.main import RequestContext, app, get_context


@pytest.fixture
def client():
    repository = MemoryRepository(seed_demo_data=True)
    app.dependency_overrides[get_context] = lambda: RequestContext(
        repository, "demo-user", "memory"
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_health_discloses_non_persistent_development_storage(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["storageMode"] == "memory"
    assert response.json()["persistent"] is False


def test_task_api_create_complete_and_next_action(client):
    created = client.post(
        "/api/tasks",
        json={
            "name": "Draft lab notes",
            "estimatedMinutes": 25,
            "priority": "medium",
            "energyRequired": "low",
            "actions": [{"label": "Open the notebook"}],
        },
    )
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["actions"][0]["label"] == "Open the notebook"
    assert client.get(f"/api/tasks/{task['id']}/next-action").json()["label"] == "Open the notebook"
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


def test_natural_language_endpoint_returns_a_draft_without_saving(client):
    before = len(client.get("/api/tasks").json())
    response = client.post("/api/tasks/parse", json={"text": "Prepare my biology notes"})
    assert response.status_code == 200
    assert response.json()["saved"] is False
    assert response.json()["draft"]["name"] == "Prepare my biology notes"
    assert len(client.get("/api/tasks").json()) == before


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