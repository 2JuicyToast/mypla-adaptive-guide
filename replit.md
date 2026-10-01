# MyPLA on Replit

The `Start application` workflow runs the Vite frontend on port 5000 and the FastAPI backend on port 8000.

To start it manually, run:

```sh
bash scripts/dev.sh
```

The project works in temporary in-memory demo mode without Supabase credentials. To prepare a local Supabase connection, copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; never commit `.env`. For Replit, use Secrets rather than a checked-in file. The frontend includes sign-up, sign-in, sign-out, and session handling. Supabase-backed requests require the signed-in user's Bearer access token.

Apply `supabase/migrations/0001_mypla_foundation.sql` to the dedicated MyPLA Supabase project before enabling persistent storage. Do not use the MyCommNet project or a service-role key.