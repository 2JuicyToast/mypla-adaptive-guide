import type { AssumptionResponse, Task, TaskAction, TaskStatus } from "@/lib/mpla-types";

export interface TaskDraft {
  name: string;
  course?: string | null;
  dueDate?: string | null;
  estimatedMinutes: number;
  priority: "high" | "medium" | "low";
  energyRequired: "high" | "medium" | "low";
  status?: TaskStatus;
  actions?: { label: string; estimatedMinutes?: number }[];
}

export interface ApiHealth {
  status: string;
  storageMode: "memory" | "supabase";
  persistent: boolean;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function getApiHealth() {
  return request<ApiHealth>("/api/health");
}

export function getTasks() {
  return request<Task[]>("/api/tasks");
}

export function createTask(draft: TaskDraft) {
  return request<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      ...draft,
      dueDate: draft.dueDate || null,
      actions: draft.actions ?? [],
    }),
  });
}

export function completeTask(taskId: string) {
  return request<Task>(`/api/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: "POST",
  });
}

export function parseTask(text: string) {
  return request<{ draft: TaskDraft; message: string; saved: false }>("/api/tasks/parse", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function submitStuck(payload: { taskId: string; actionId?: string; reason: string; detail?: string }) {
  return request<{ message: string; suggestions: string[] }>("/api/stuck", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function respondToAssumption(
  assumptionId: string,
  response: AssumptionResponse,
) {
  return request(`/api/assumptions/${encodeURIComponent(assumptionId)}/response`, {
    method: "POST",
    body: JSON.stringify({ answer: response.answer, correction: response.correction || null }),
  });
}

export function nextUnfinishedAction(actions: TaskAction[]) {
  return actions.find((action) => !action.done);
}