@echo off
setlocal
cd /d "%~dp0"

echo [1/3] Ensuring MongoDB service is running...
sc query MongoDB | findstr /i "RUNNING" >nul
if errorlevel 1 (
    echo Starting MongoDB service...
    net start MongoDB
) else (
    echo MongoDB is running.
)

echo [2/3] Starting Backend (FastAPI on port 8001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001') do taskkill /f /pid %%a >nul 2>&1
wscript.exe "%~dp0invis.vbs" "%~dp0run_backend.bat"

echo [3/3] Starting Frontend (React on port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a >nul 2>&1
wscript.exe "%~dp0invis.vbs" "%~dp0run_frontend.bat"

echo.
echo All services started in background!
echo Web App URL: http://localhost:3000
echo API URL:     http://localhost:8001/api/
echo.
