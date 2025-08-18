#!/usr/bin/env bash
set -euo pipefail

cd /mnt/c/CursorProjects/Omnia

# Start Express (3100) if not running
if ! pgrep -f "node server.js" >/dev/null; then
  cd backend
  nohup node server.js > ~/express.log 2>&1 &
  cd ..
fi

# Start FastAPI (8000) if not running
if ! pgrep -f "uvicorn.*groq_ddt_api:app" >/dev/null; then
  source .venv/bin/activate
  nohup uvicorn backend.groq_ddt_api:app --host 0.0.0.0 --port 8000 --reload > ~/fastapi.log 2>&1 &
fi

echo "Express: http://localhost:3100 (log: ~/express.log)"
echo "FastAPI: http://localhost:8000 (log: ~/fastapi.log)"