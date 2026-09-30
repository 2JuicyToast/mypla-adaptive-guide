# MyPLA — My Planning Assistant

MyPLA is a student-focused planning assistant. Its rule is: **the assistant suggests; the user decides.** The existing Lovable React interface remains the frontend baseline. Python owns planning rules, and Supabase is the persistent data layer when configured.

The Replit repository root is the MyPLA project root. The existing frontend was kept in place rather than moved into a duplicate nested directory.

## Current foundation

- **Frontend:** React 19, TanStack Start/Router, Vite, and Tailwind CSS.
- **Backend:** Python 3.11, FastAPI, Pydantic, and modular deterministic services in `backend/`.
- **Storage:** a temporary in-memory development repository when Supabase is not configured; a user-scoped Supabase Data API repository when it is.
- **Database:** the initial relational schema and `auth.uid()`-scoped row-level security policies are in `supabase/migrations/`.
- **Tests:** deterministic service tests are in `tests/`.

No LLM, automatic priority learning, MyRPG mechanics, or automatic assistant commits are implemented.

## Run on Replit

The `Start application` workflow starts the FastAPI server on port 8000 and the web app on port 5000. The frontend proxies `/api` and `/health` to FastAPI.

For local development:

```sh
bun install --frozen-lockfile
python3 -m pytest
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
- `GET /health` and `/api/health` report the active storage mode.

Task priority is deterministic. Deadline contributes up to 45 points, importance 30, estimated duration 15, and energy fit 10. The weights are constants in `backend/services/priority_engine.py`. The scheduler filters tasks that fit the available time and creates a pending proposal; it does not book work automatically. Proposal rejection never commits its changes.

The API has seeded example tasks only in memory mode so the existing screens remain useful in the preview. In-memory changes disappear when the API restarts. The screens identify this mode and keep the original mock data visible if the API is unavailable.

## Supabase

The migration creates `profiles`, `projects`, `tasks`, `task_actions`, `schedule_blocks`, `proposals`, `coach_knowledge`, `resources`, `reflections`, and `stuck_reports`. User-owned rows use individual RLS policies tied to `auth.uid()`; no service-role key is used.

Apply `supabase/migrations/0001_mypla_foundation.sql` to the dedicated MyPLA Supabase project. Configure these Replit Secrets:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Both are required to switch the backend out of demo memory mode. Supabase-backed requests require a valid signed-in user's Bearer token; the backend verifies the token and passes it to PostgREST so the database policies remain authoritative. This repository does not yet include a sign-in screen/session provider, so the frontend currently runs against temporary memory storage until that authentication UI is added and connected.

Never commit `.env`; it is ignored by Git. Do not use the separate MyCommNet Supabase project or put a service-role key in frontend code.

## Python modules

- `TaskManager` owns task creation, completion, next-action lookup, and ordering.
- `PriorityEngine` calculates a score and human-readable explanation with fixed weights.
- `Scheduler` exposes a typical weekday pattern and time-fit recommendations.
- `ProposalService` stores suggested changes and commits supported changes only after approval.
- `AssumptionService` records Yes/No/Not sure and user corrections as confirmed, observed, or suggested knowledge.
- `AIService` is an interface placeholder with deterministic responses; it does not call an LLM.
- `export_for_myrpg` defines a future data hand-off only.

## Checks

```sh
python3 -m pytest
bun run build
```