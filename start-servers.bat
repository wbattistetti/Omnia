@echo off
echo ========================================
echo        OMNIA SERVER STARTUP
echo ========================================

echo [0/3] Starting Redis...
docker-compose up -d redis
if %errorlevel% neq 0 (
    echo [REDIS] ⚠️  Failed to start Redis. Make sure Docker is running.
    echo [REDIS] You can start Redis manually with: docker-compose up -d redis
    pause
    exit /b 1
)
echo [REDIS] ✅ Redis started on localhost:6379
timeout /t 2 /nobreak >nul

echo [1/3] Starting Express server...
start "Express Server" npm run be:express

echo [2/3] Waiting 5 seconds for Express to start...
timeout /t 5 /nobreak

echo [3/3] Starting FastAPI server...
start "FastAPI Server" npm run be:apiNew

echo ========================================
echo    Servers started! Check terminals:
echo    - Redis: localhost:6379
echo    - Express: http://localhost:3100
echo    - FastAPI: http://localhost:8000
echo    - VB.NET: Launch manually from Visual Studio
echo ========================================

echo Press any key to close this window...
pause >nul
