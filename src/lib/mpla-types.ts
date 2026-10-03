/**
 * MyPLA domain types.
 *
 * These shapes are the contract the future Python backend is expected to
 * serve. Keep them free of UI concerns so they can be generated/validated
 * server-side later.
 */

export type Priority = "high" | "medium" | "low";
export type EnergyLevel = "high" | "medium" | "low";

export type TaskStatus = "current" | "upcoming" | "explore" | "done";

export interface TaskAction {
  id: string;
  label: string;
  done: boolean;
  description?: string | null;
  /** Minutes the assistant estimates for this single action. */
  estimatedMinutes?: number | null;
  energyRequired?: EnergyLevel | null;
  position?: number;
  parentActionId?: string | null;
}

export interface TaskBreakdownAction {
  label: string;
  description?: string | null;
  estimatedMinutes?: number | null;
  energyRequired?: EnergyLevel | null;
}

export interface Task {
  id: string;
  name: string;
  description?: string | null;
  course?: string;
  category?: string | null;
  priority: Priority;
  /** ISO date string. */
  dueDate?: string | null;
  estimatedMinutes: number;
  energyRequired: EnergyLevel;
  status: TaskStatus;
  actions: TaskAction[];
  /** Short line explaining why the assistant surfaced this task now. */
  assistantNote?: string;
}

export type ProposalKind =
  "reschedule" | "priority-change" | "task-breakdown" | "new-task" | "schedule-block";

/**
 * Anything the assistant wants to change is first a Proposal.
 * Nothing is committed until the user approves it.
 */
export interface Proposal {
  id: string;
  kind: ProposalKind;
  title: string;
  rationale: string;
  status: "pending" | "approved" | "edited" | "rejected" | "expired";
  proposedChanges: Record<string, unknown>;
  /** Human-readable before/after lines rendered in the proposal card. */
  changes: { field: string; before: string; after: string }[];
  relatedTaskId?: string;
  createdAt: string;
}

export interface AssumptionCheck {
  id: string;
  question: string;
  context?: string;
  relatedTaskId?: string;
}

export type AssumptionAnswer = "yes" | "no" | "not-sure";

export interface AssumptionResponse {
  assumptionId: string;
  answer: AssumptionAnswer;
  correction?: string;
}

export interface ExploreOpportunity {
  id: string;
  title: string;
  category: "skill" | "wellbeing" | "career" | "social" | "admin";
  description: string;
  estimatedMinutes: number;
  energyRequired: EnergyLevel;
}

export interface ResourceRecommendation {
  id: string;
  title: string;
  type: "tool" | "reading" | "video" | "template";
  reason: string;
  relatedTaskId?: string;
}

export interface ScheduleBlock {
  id: string;
  label: string;
  /** 24h "HH:MM" for display. */
  start: string;
  end: string;
  kind: "class" | "study" | "commute" | "break" | "personal" | "free";
  taskId?: string;
  startAt?: string;
  endAt?: string;
}

export interface WeeklyReflectionPrompt {
  id: string;
  question: string;
  placeholder?: string;
}

export interface ScheduleNotification {
  id: string;
  message: string;
  time: string;
  relatedTaskId?: string;
  /** Interactive replies the user can pick; none commit state automatically. */
  options: string[];
}

export interface StuckReason {
  id: string;
  label: string;
  description: string;
}
