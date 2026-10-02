import { ApiRequestError } from "./api-error";

export type TaskParseStatus =
  "idle" | "preparing" | "ready" | "unavailable" | "rate-limited" | "incomplete" | "invalid-draft";

export function taskParseFailureStatus(
  error: unknown,
): "unavailable" | "rate-limited" | "incomplete" | "invalid-draft" {
  if (!(error instanceof ApiRequestError)) return "unavailable";
  if (error.status === 429) return "rate-limited";
  if (error.status === 502) return "incomplete";
  if (error.status === 422) return "invalid-draft";
  return "unavailable";
}
