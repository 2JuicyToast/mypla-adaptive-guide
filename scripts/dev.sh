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
web_pid=""

stop_process_tree() {
  local pid="$1"
  local child

  while read -r child; do
    [[ -n "$child" ]] && stop_process_tree "$child"
  done < <(ps -o pid= --ppid "$pid" 2>/dev/null || true)

  kill -TERM "$pid" 2>/dev/null || true
}

cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$web_pid" ]]; then
    stop_process_tree "$web_pid"
    wait "$web_pid" 2>/dev/null || true
  fi
  stop_process_tree "$api_pid"
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

bun run dev:web &
web_pid=$!
wait "$web_pid"