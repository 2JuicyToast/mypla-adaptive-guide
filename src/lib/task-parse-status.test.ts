import { expect, test } from "bun:test";

import { ApiRequestError } from "./api-error";
import { taskParseFailureStatus } from "./task-parse-status";

test("shows a distinct status for rate limits", () => {
  expect(taskParseFailureStatus(new ApiRequestError(429, "upstream details"))).toBe("rate-limited");
});

test("keeps other API and network failures in the unavailable state", () => {
  expect(taskParseFailureStatus(new ApiRequestError(503, "upstream details"))).toBe("unavailable");
  expect(taskParseFailureStatus(new TypeError("network details"))).toBe("unavailable");
});

test("shows separate statuses for incomplete and invalid structured drafts", () => {
  expect(taskParseFailureStatus(new ApiRequestError(502, "safe incomplete response"))).toBe(
    "incomplete",
  );
  expect(taskParseFailureStatus(new ApiRequestError(422, "safe invalid draft"))).toBe(
    "invalid-draft",
  );
});
