import { ApiRequestError } from "./api-error";

export type TaskParseStatus =
  | "idle"
  | "preparing"
  | "ready"
  | "unavailable"
  | "rate-limited";

export function taskParseFailureStatus(error: unknown): "unavailable" | "rate-limited" {
  return error instanceof ApiRequestError && error.status === 429
    ? "rate-limited"
    : "unavailable";
}