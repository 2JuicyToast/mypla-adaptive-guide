# MyPLA on Replit

The `Start application` workflow runs the Vite frontend on port 5000 and the FastAPI backend on port 8000.

To start it manually, run:

```sh
bash scripts/dev.sh
```

The startup script synchronizes frontend and Python dependencies from the checked-in lockfiles, so a fresh workspace does not need a separate install step. If a local `.env` file exists, it is loaded by the API; Replit Secrets remain the recommended configuration on Replit.

The project works in temporary in-memory demo mode without Supabase credentials. To prepare a local Supabase connection, copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; never commit `.env`. For Replit, use Secrets rather than a checked-in file. The frontend includes sign-up, sign-in, sign-out, and session handling. Supabase-backed requests require the signed-in user's Bearer access token.

Apply `supabase/migrations/0001_mypla_foundation.sql` to the dedicated MyPLA Supabase project before enabling persistent storage. Do not use the MyCommNet project or a service-role key.

Natural-language task parsing uses the server-side `OPENROUTER_API_KEY` Secret and defaults to `nvidia/nemotron-3-super-120b-a12b:free` (`OPENROUTER_MODEL` can override it). The parser sends only the task-intake text, returns an unsaved draft, and requires a signed-in user. Never add the provider key to frontend code, logs, or checked-in files; avoid sending sensitive task details to the free model.