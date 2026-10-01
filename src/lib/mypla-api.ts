import type { AssumptionResponse, Proposal, Task, TaskAction, TaskStatus } from "@/lib/mpla-types";
import { getSupabaseAccessToken } from "@/lib/supabase-client";

export interface TaskDraft {
  name: string;
  description?: string | null;
  course?: string | null;
  category?: string | null;
  dueDate?: string | null;
  estimatedMinutes: number;
  priority: "high" | "medium" | "low";
  energyRequired: "high" | "medium" | "low";
  status?: TaskStatus;
  actions?: {
    label: string;
    description?: string | null;
    estimatedMinutes?: number | null;
    energyRequired?: "high" | "medium" | "low" | null;
    parentActionId?: string | null;
  }[];
}

export interface ApiHealth {
  status: string;
  storageMode: "memory" | "supabase";
  persistent: boolean;
}

export interface ApiAssumption {
  id: string;
  topic: string;
  statement: string;
  confidence: "confirmed" | "observed" | "suggested";
  userCorrection?: string | null;
  relatedTaskId?: string | null;
}

export interface ApiResource {
  id: string;
  name: string;
  type: "tool" | "reading" | "video" | "template" | string;
  url?: string | null;
  purpose: string;
  whenUseful?: string | null;
  savedPrompt?: string | null;
  personalNote?: string | null;
  tags: string[];
}

export interface ApiReflection {
  id: string;
  week: string;
  summary: string;
  whatWentWell: string;
  challenges: string;
  helpfulStrategies: string;
  thingsToRemember: string;
}

export interface ApiScheduleBlock {
  id: string;
  title: string;
  kind: "fixed" | "flexible" | "break" | "routine" | "transition";
  start: string;
  end: string;
  taskId?: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const endpoint = url.split("?")[0];
  if (endpoint !== "/api/client-config" && endpoint !== "/api/health" && endpoint !== "/health") {
    const accessToken = await getSupabaseAccessToken();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
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

export function getProposals() {
  return request<Proposal[]>("/api/proposals");
}

export function getAssumptions() {
  return request<ApiAssumption[]>("/api/assumptions");
}

export function resolveProposal(
  proposalId: string,
  decision: "approve" | "reject" | "adjust",
  changes?: Record<string, unknown>,
) {
  return request<Proposal>(`/api/proposals/${encodeURIComponent(proposalId)}/${decision}`, {
    method: "POST",
    ...(decision === "adjust" ? { body: JSON.stringify({ changes }) } : {}),
  });
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

export function completeTaskAction(taskId: string, actionId: string) {
  return request<Task>(
    `/api/tasks/${encodeURIComponent(taskId)}/actions/${encodeURIComponent(actionId)}/complete`,
    { method: "POST" },
  );
}

export function parseTask(text: string) {
  return request<{ draft: TaskDraft; message: string; saved: false }>("/api/tasks/parse", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function submitStuck(payload: {
  taskId: string;
  actionId?: string;
  reason: string;
  detail?: string;
}) {
  return request<{ message: string; suggestions: string[] }>("/api/stuck", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function respondToAssumption(assumptionId: string, response: AssumptionResponse) {
  return request<ApiAssumption>(`/api/assumptions/${encodeURIComponent(assumptionId)}/response`, {
    method: "POST",
    body: JSON.stringify({ answer: response.answer, correction: response.correction || null }),
  });
}

export function getSchedule(day?: string) {
  const query = day ? `?day=${encodeURIComponent(day)}` : "";
  return request<ApiScheduleBlock[]>(`/api/schedule${query}`);
}

export function suggestSchedule(payload: { minutes: number; energy?: string; start?: string }) {
  return request<Proposal>("/api/schedule/suggestions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getResources() {
  return request<ApiResource[]>("/api/resources");
}

export function createResource(resource: Omit<ApiResource, "id">) {
  return request<ApiResource>("/api/resources", {
    method: "POST",
    body: JSON.stringify(resource),
  });
}

export function getReflections() {
  return request<ApiReflection[]>("/api/reflections");
}

export function saveReflection(reflection: Omit<ApiReflection, "id">) {
  return request<ApiReflection>("/api/reflections", {
    method: "POST",
    body: JSON.stringify(reflection),
  });
}

export function nextUnfinishedAction(actions: TaskAction[]) {
  return actions.find((action) => !action.done);
}
