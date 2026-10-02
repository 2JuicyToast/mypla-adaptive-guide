---
name: OpenRouter structured task output limits
description: Observed reason Nemotron 3 Super may truncate MyPLA task drafts under the context-free strict-JSON parser.
---

For MyPLA's OpenRouter task parser, Nemotron can return `finish_reason: length` even with minimal reasoning effort. Treat incomplete structured output as untrusted and unsaved. More output tokens and a shorter action list can help but do not guarantee a successful response across prompts. Never expose raw provider bodies or diagnostics in the UI; keep guided task entry available as the fallback.

**Why:** On 2026-10-02, one synthetic physics-lab request returned a valid Thursday deadline and an unsaved draft, while several other synthetic requests truncated or failed after retries at multiple output budgets.

**How to apply:** Before declaring task parsing reliable, replay the full synthetic prompt suite against the configured endpoint. Verify API draft generation separately from the signed-in review, confirmation, and persistence boundary.