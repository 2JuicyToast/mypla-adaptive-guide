#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

for command in bun uv; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command '$command' is not installed." >&2
    exit 1
  fi
done

# Reconcile both environments from their checked-in lockfiles so a fresh
# workspace can start without a separate manual dependency setup.
bun install --frozen-lockfile
uv sync --frozen

api_args=(backend.main:app --host 127.0.0.1 --port 8000)
if [[ -f .env ]]; then
  api_args+=(--env-file .env)
fi

uv run --frozen --no-sync python -m uvicorn "${api_args[@]}" &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

bun run dev:web