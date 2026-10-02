import type { Task, TaskAction, EnergyLevel } from "@/lib/mpla-types";

export type TaskSessionContext = "ready" | "less-time" | "low-energy" | "unsure" | "in-the-way";

export type TaskSessionStatus = "check-in" | "unsure" | "active";

/**
 * A deliberately small, local snapshot for one focus session. It contains only
 * the next unfinished action, never the task's full action list.
 */
export interface TaskSession {
  taskId: string;
  taskName: string;
  dueDate?: string | null;
  estimatedMinutes: number;
  energyRequired: EnergyLevel;
  currentActionId: string | null;
  currentActionText: string | null;
  startedAt: string;
  context: TaskSessionContext | null;
  status: TaskSessionStatus;
  note?: string;
}

function firstUnfinishedAction(task: Task): TaskAction | null {
  return task.actions.find((action) => !action.done) ?? null;
}

export function createTaskSession(task: Task, startedAt = new Date().toISOString()): TaskSession {
  const action = firstUnfinishedAction(task);
  return {
    taskId: task.id,
    taskName: task.name,
    ...(task.dueDate === undefined ? {} : { dueDate: task.dueDate }),
    estimatedMinutes: task.estimatedMinutes,
    energyRequired: task.energyRequired,
    currentActionId: action?.id ?? null,
    currentActionText: action?.label ?? null,
    startedAt,
    context: null,
    status: "check-in",
  };
}

export function chooseTaskSessionContext(
  session: TaskSession,
  context: TaskSessionContext,
): TaskSession {
  if (context === "ready") {
    return { ...session, context, status: "active" };
  }
  return {
    ...session,
    context,
    status: context === "unsure" ? "unsure" : "check-in",
  };
}

export function startWithCurrentAction(session: TaskSession): TaskSession {
  return { ...session, status: "active" };
}

export function updateTaskSessionNote(session: TaskSession, note: string): TaskSession {
  return { ...session, note };
}

export function advanceTaskSession(session: TaskSession, updatedTask: Task): TaskSession {
  const next = firstUnfinishedAction(updatedTask);
  const refreshedSession = { ...session };
  if (updatedTask.dueDate === undefined) delete refreshedSession.dueDate;
  return {
    ...refreshedSession,
    taskName: updatedTask.name,
    ...(updatedTask.dueDate === undefined ? {} : { dueDate: updatedTask.dueDate }),
    estimatedMinutes: updatedTask.estimatedMinutes,
    energyRequired: updatedTask.energyRequired,
    currentActionId: next?.id ?? null,
    currentActionText: next?.label ?? null,
    status: "active",
  };
}

/** Ending a session is intentionally separate from completing a task. */
export function endTaskSession(_session: TaskSession): null {
  return null;
}
