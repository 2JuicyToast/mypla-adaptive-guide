import { expect, test } from "bun:test";

import type { Task } from "@/lib/mpla-types";
import {
  advanceTaskSession,
  chooseTaskSessionContext,
  createTaskSession,
  endTaskSession,
  startWithCurrentAction,
} from "@/lib/task-session";

const task: Task = {
  id: "task-1",
  name: "Read the research article",
  course: "BIO 105",
  priority: "medium",
  dueDate: "2026-10-04",
  estimatedMinutes: 35,
  energyRequired: "medium",
  status: "current",
  actions: [
    { id: "a1", label: "Open the article", done: true },
    { id: "a2", label: "Read the abstract", done: false, estimatedMinutes: 5 },
    { id: "a3", label: "Annotate the methods", done: false },
  ],
};

test("session snapshots the task and only its first unfinished action", () => {
  const session = createTaskSession(task, "2026-10-01T12:00:00.000Z");

  expect(session).toMatchObject({
    taskId: "task-1",
    taskName: "Read the research article",
    dueDate: "2026-10-04",
    estimatedMinutes: 35,
    energyRequired: "medium",
    currentActionId: "a2",
    currentActionText: "Read the abstract",
    startedAt: "2026-10-01T12:00:00.000Z",
    status: "check-in",
  });
  expect(session).not.toHaveProperty("actions");
  expect(session.currentActionText).not.toContain("Annotate");
});

test("context updates remain local and never mutate the task", () => {
  const before = structuredClone(task);
  const session = chooseTaskSessionContext(createTaskSession(task), "low-energy");

  expect(session.context).toBe("low-energy");
  expect(session.status).toBe("check-in");
  expect(task).toEqual(before);
});

test("ready and start-with-current-action enter the active state", () => {
  const initial = createTaskSession(task);
  expect(chooseTaskSessionContext(initial, "ready")).toMatchObject({
    context: "ready",
    status: "active",
  });
  expect(startWithCurrentAction(chooseTaskSessionContext(initial, "unsure"))).toMatchObject({
    context: "unsure",
    status: "active",
  });
});

test("ending a session clears local session state without completing a task", () => {
  const session = createTaskSession(task);
  expect(endTaskSession(session)).toBeNull();
  expect(task.status).toBe("current");
  expect(task.actions.some((action) => action.done)).toBe(true);
  expect(task.actions.find((action) => action.id === "a2")?.done).toBe(false);
});

test("refreshing after an action advances to the next unfinished action", () => {
  const session = startWithCurrentAction(createTaskSession(task));
  const refreshed: Task = {
    ...task,
    actions: task.actions.map((action) =>
      action.id === "a2" ? { ...action, done: true } : action,
    ),
  };

  expect(advanceTaskSession(session, refreshed)).toMatchObject({
    currentActionId: "a3",
    currentActionText: "Annotate the methods",
    status: "active",
  });
});
