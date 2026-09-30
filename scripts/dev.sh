#!/usr/bin/env bash
set -euo pipefail

python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

bun run dev:web