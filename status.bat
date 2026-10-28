@echo off
setlocal
echo ========================================================
echo               ThinkCloud IPAM Status Check
echo ========================================================
echo.

echo [1] MongoDB Service:
sc query MongoDB | findstr /i "STATE"

echo.
echo [2] Backend Service (Port 8001):
netstat -ano | findstr :8001 >nul
if errorlevel 1 (
    echo     Status: NOT RUNNING
) else (
    echo     Status: RUNNING (Listening on port 8001)
)

echo.
echo [3] Frontend Service (Port 3000):
netstat -ano | findstr :3000 >nul
if errorlevel 1 (
    echo     Status: NOT RUNNING
) else (
    echo     Status: RUNNING (Listening on port 3000)
)

echo.
echo ========================================================
echo Web App: http://localhost:3000
echo API:     http://localhost:8001/api/
echo ========================================================
