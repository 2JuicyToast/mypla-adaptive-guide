from datetime import date, datetime

import pytest
from fastapi import HTTPException

from backend.database.repository import MemoryRepository
from backend.models import (
    Assumption,
    AssumptionAnswer,
    AssumptionResponse,
    ProposalCreate,
    Task,
    TaskAction,
    TaskCreate,
)
from backend.services.assumptions import AssumptionService
from backend.services.priority_engine import PriorityEngine
from backend.services.proposals import ProposalService
from backend.services.scheduler import Scheduler
from backend.services.task_manager import TaskManager


@pytest.fixture
def store():
    return MemoryRepository()


@pytest.fixture
def task_manager(store):
    return TaskManager(store, "student-1", PriorityEngine())


def test_task_creation_and_completion(task_manager):
    task = task_manager.add_task(
        TaskCreate(
            name="Review lecture notes",
            dueDate=date(2026, 10, 1),
            actions=[{"label": "Read notes"}],
        )
    )
    assert task.user_id == "student-1"
    assert task.actions[0].label == "Read notes"
    completed = task_manager.complete_task(task.id)
    assert completed.status == "done"
    assert completed.completed_at is not None


def test_priority_calculation_is_deterministic():
    task = Task(
        name="Urgent short task",
        dueDate=date(2026, 9, 30),
        estimatedMinutes=20,
        priority="high",
        energyRequired="low",
    )
    engine = PriorityEngine()
    first = engine.score(task, today=date(2026, 9, 30))
    second = engine.score(task, today=date(2026, 9, 30))
    assert first == second
    assert first.score == 95
    assert "today" in first.explanation


def test_deadline_outweighs_low_importance_later_task():
    engine = PriorityEngine()
    urgent = Task(name="Due today", dueDate=date(2026, 9, 30), priority="low")
    later = Task(name="Due later", dueDate=date(2026, 10, 20), priority="high")
    assert engine.score(urgent, today=date(2026, 9, 30)).score > engine.score(
        later, today=date(2026, 9, 30)
    ).score


def test_next_action_skips_completed_actions(task_manager):
    task = task_manager.add_task(
        TaskCreate(
            name="Essay",
            actions=[
                {"label": "Choose sources"},
                {"label": "Write thesis"},
            ],
        )
    )
    task.actions[0].done = True
    task_manager.repository.save_task(task)
    assert task_manager.get_next_action(task.id)["label"] == "Write thesis"


def test_task_ordering_is_persisted(task_manager):
    one = task_manager.add_task(TaskCreate(name="One"))
    two = task_manager.add_task(TaskCreate(name="Two"))
    ordered = task_manager.reorder_tasks([two.id, one.id])
    assert [task.id for task in ordered] == [two.id, one.id]
    assert task_manager.find_task(two.id).position == 0
    assert task_manager.find_task(one.id).position == 1


def test_proposal_approval_commits_but_rejection_does_not(store, task_manager):
    service = ProposalService(store, "student-1", task_manager)
    approved = service.create(
        ProposalCreate(
            kind="new-task",
            title="Add reading",
            proposedChanges={"task": {"name": "Read chapter 9"}},
        )
    )
    rejected = service.create(
        ProposalCreate(
            kind="new-task",
            title="Add lab",
            proposedChanges={"task": {"name": "Lab report"}},
        )
    )
    service.resolve(approved.id, "approve")
    service.resolve(rejected.id, "reject")
    names = [task.name for task in store.list_tasks("student-1")]
    assert "Read chapter 9" in names
    assert "Lab report" not in names


def test_proposal_cannot_be_approved_twice(store, task_manager):
    service = ProposalService(store, "student-1", task_manager)
    proposal = service.create(ProposalCreate(kind="note", title="A note"))
    service.resolve(proposal.id, "reject")
    with pytest.raises(HTTPException) as error:
        service.resolve(proposal.id, "approve")
    assert error.value.status_code == 409


def test_assumption_correction_is_recorded_without_silent_confirmation(store):
    assumption = store.save_assumption(
        Assumption(
            userId="student-1", topic="schedule", statement="You like early mornings."
        )
    )
    service = AssumptionService(store, "student-1")
    result = service.respond(
        assumption.id,
        AssumptionResponse(answer=AssumptionAnswer.NO, correction="Late mornings work better."),
    )
    assert result.statement == "Late mornings work better."
    assert result.user_correction == "Late mornings work better."
    assert result.confidence == "confirmed"


def test_uncertain_assumption_stays_suggested(store):
    from backend.models import Assumption

    assumption = store.save_assumption(
        Assumption(userId="student-1", topic="energy", statement="Afternoons are easier.")
    )
    result = AssumptionService(store, "student-1").respond(
        assumption.id, AssumptionResponse(answer=AssumptionAnswer.NOT_SURE)
    )
    assert result.confidence == "suggested"


def test_basic_schedule_and_recommendation(store):
    scheduler = Scheduler()
    day = date(2026, 9, 30)
    assert scheduler.typical_weekday(day)
    assert scheduler.typical_weekday(date(2026, 10, 3)) == []
    tasks = [
        Task(id="long", name="Long task", estimatedMinutes=90, dueDate=date(2026, 10, 1)),
        Task(id="short", name="Short task", estimatedMinutes=25, dueDate=date(2026, 10, 1)),
    ]
    result = scheduler.recommend(tasks, available_minutes=30, current_energy=None)
    assert [task.id for task in result] == ["short"]


def test_reorder_rejects_tasks_owned_by_another_user(store, task_manager):
    foreign_task = store.save_task(Task(id="private-task", userId="student-2", name="Private"))
    with pytest.raises(HTTPException) as error:
        task_manager.find_task(foreign_task.id)
    assert error.value.status_code == 404