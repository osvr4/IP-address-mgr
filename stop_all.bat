@echo off
setlocal
echo Stopping IPAM services...

schtasks /End /TN "IPAM_Backend" >nul 2>&1
schtasks /End /TN "IPAM_Frontend" >nul 2>&1

echo Stopping Backend on port 8001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001') do taskkill /f /pid %%a >nul 2>&1

echo Stopping Frontend on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a >nul 2>&1

echo Services stopped.
