# MyPLA — My Planning Assistant

MyPLA is a student-focused planning assistant. Its rule is: **the assistant suggests; the user decides.** The existing Lovable React interface remains the frontend baseline. Python owns planning rules, and Supabase is the persistent data layer when configured.

The Replit repository root is the MyPLA project root. The existing frontend was kept in place rather than moved into a duplicate nested directory.

## Current foundation

- **Frontend:** React 19, TanStack Start/Router, Vite, and Tailwind CSS.
- **Backend:** Python 3.11, FastAPI, Pydantic, deterministic planning services, and a provider-neutral task parsing service in `backend/`.
- **Storage:** a temporary in-memory development repository when Supabase is not configured; a user-scoped Supabase Data API repository when it is.
- **Database:** the initial relational schema and `auth.uid()`-scoped row-level security policies are in `supabase/migrations/`.
- **Tests:** deterministic service tests are in `tests/`.

Natural-language task parsing is the first limited LLM feature: it sends only the task-intake text to OpenRouter and returns an unsaved, schema-validated draft. Users review/edit it before saving. It does not add chat memory, embeddings, tool use, agent loops, autonomous behavior, or automatic assistant commits. Python's `PriorityEngine` remains the authority for final priority scores.

## Run on Replit

The `Start application` workflow starts the FastAPI server on port 8000 and the web app on port 5000. The frontend proxies `/api` and `/health` to FastAPI.

For local development:

```sh
bun install --frozen-lockfile
uv run --frozen python -m pytest
bun run build
```

Start both servers together with:

```sh
bash scripts/dev.sh
```

The servers can also be run separately with `python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload` and `bun run dev:web`.

## Project layout

```text
backend/
  main.py                 FastAPI routes
  models.py               Validated domain and API models
  database/repository.py  Memory and Supabase storage adapters
  services/               Tasks, priority, schedule, proposals, assumptions, AI boundary
src/                      Existing Lovable React frontend
supabase/migrations/      PostgreSQL schema and RLS policies
tests/                    Python service tests
scripts/dev.sh            Combined Replit development command
```

## API

- `GET/POST /api/tasks`, `PATCH /api/tasks/{id}`, `POST /api/tasks/{id}/complete`
- `POST /api/tasks/{id}/actions/{action_id}/complete`, `GET /api/tasks/{id}/next-action`
- `POST /api/tasks/reorder`, `POST /api/tasks/parse`
- `GET/POST /api/proposals`, and approve, adjust, or reject endpoints
- `GET /api/assumptions`, `POST /api/assumptions/{id}/response`
- `POST /api/stuck`
- `GET /api/schedule`, `POST /api/schedule/suggestions`
- `GET/POST /api/resources`, `GET/POST /api/reflections`
- `GET /api/myrpg/export` (future export shape only)
- `GET /health` and `/api/health` report the active storage mode and whether Supabase and OpenRouter are configured. Task parsing distinguishes missing configuration, provider outages, and rate limits without exposing upstream diagnostics.

Task priority is deterministic. Deadline contributes up to 45 points, importance 30, estimated duration 15, and energy fit 10. The weights are constants in `backend/services/priority_engine.py`. The scheduler filters tasks that fit the available time and creates a pending proposal; it does not book work automatically. Proposal rejection never commits its changes.

The API has seeded example tasks only in memory mode so the existing screens remain useful in the preview. In-memory changes disappear when the API restarts. The screens identify this mode and keep the original mock data visible if the API is unavailable.

## Supabase

The migration creates `profiles`, `projects`, `tasks`, `task_actions`, `schedule_blocks`, `proposals`, `coach_knowledge`, `resources`, `reflections`, and `stuck_reports`. User-owned rows use individual RLS policies tied to `auth.uid()`; no service-role key is used.

Apply `supabase/migrations/0001_mypla_foundation.sql` to the dedicated MyPLA Supabase project. Configure these Replit Secrets:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Both are required to switch the backend out of demo memory mode. Supabase-backed requests require a valid signed-in user's Bearer token; the backend verifies the token and passes it to PostgREST so the database policies remain authoritative. The React frontend includes Supabase sign-up, sign-in, sign-out, and session handling. Without the Supabase settings, the backend remains in temporary memory mode.

## OpenRouter task parsing

Set `OPENROUTER_API_KEY` as a Replit Secret. The parser defaults to `nvidia/nemotron-3-super-120b-a12b:free`; `OPENROUTER_MODEL` can override the model. The key stays in FastAPI and is never sent to the browser. The authenticated `/api/tasks/parse` endpoint sends only the submitted task text to OpenRouter, requests strict JSON Schema output, and validates the result with `TaskCreate`. It returns `saved: false`; only the existing task-create endpoint writes data after the user confirms the editable review.

Parsing fails with a clear response if the key is missing, the provider is unavailable/rate-limited, or the returned draft fails validation. Do not send confidential or sensitive details to the free model. A successful API health response does not verify the OpenRouter key or Supabase schema.

Never commit `.env`; it is ignored by Git. Do not use the separate MyCommNet Supabase project or put a service-role key in frontend code.

## Python modules

- `TaskManager` owns task creation, completion, next-action lookup, and ordering.
- `PriorityEngine` calculates a score and human-readable explanation with fixed weights.
- `Scheduler` exposes a typical weekday pattern and time-fit recommendations.
- `ProposalService` stores suggested changes and commits supported changes only after approval.
- `AssumptionService` records Yes/No/Not sure and user corrections as confirmed, observed, or suggested knowledge.
- `AIService` is a provider-neutral boundary for context-free task parsing. Its OpenRouter adapter returns an unsaved, validated draft; deterministic priority scoring and task creation remain in Python.
- `export_for_myrpg` defines a future data hand-off only.

## Checks

```sh
python3 -m pytest
bun run build
```