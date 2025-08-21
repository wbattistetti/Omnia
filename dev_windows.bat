@echo off
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION
title Omnia DEV (Express + FastAPI)

REM Change to repo root (this script's directory)
cd /d "%~dp0"

REM 1) Ensure Node backend (Express) and Python venv (FastAPI)
if not exist .venv (
  echo [DEV] Creating Python venv...
  python -m venv .venv
)

echo [DEV] Activating venv and installing Python deps if missing...
call .\.venv\Scripts\activate
python -m pip install --upgrade pip >nul 2>&1
pip install fastapi uvicorn[standard] requests >nul 2>&1

REM 2) Configure proxy base for FastAPI -> Express
set EXPRESS_BASE=http://localhost:3100

REM 3) Start Express (port 3100) in a new window
start "EXPRESS 3100" cmd /c "node backend\server.js"

REM 4) Start FastAPI (port 8000) in a new window
start "FASTAPI 8000" cmd /c ".\.venv\Scripts\activate && uvicorn backend.groq_ddt_api:app --host 127.0.0.1 --port 8000 --reload"

echo.
echo [DEV] Started. Endpoints to check:
echo   - Express:  http://127.0.0.1:3100/api/factory/dialogue-templates
echo   - FastAPI:  http://127.0.0.1:8000/api/factory/dialogue-templates
echo   - AgentActs:http://127.0.0.1:3100/api/factory/agent-acts
echo.
echo [DEV] Close these two windows (EXPRESS 3100 / FASTAPI 8000) to stop backends.
exit /b 0


