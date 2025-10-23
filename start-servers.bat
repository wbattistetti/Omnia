@echo off
echo ========================================
echo        OMNIA SERVER STARTUP
echo ========================================

echo [1/3] Starting Express server...
start "Express Server" npm run be:express

echo [2/3] Waiting 5 seconds for Express to start...
timeout /t 5 /nobreak

echo [3/3] Starting FastAPI server...
start "FastAPI Server" npm run be:apiNew

echo ========================================
echo    Servers started! Check terminals:
echo    - Express: http://localhost:3100
echo    - FastAPI: http://localhost:8000
echo ========================================

echo Press any key to close this window...
pause >nul
