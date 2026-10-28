@echo off
cd /d "C:\Users\Administrator\Documents\IP_emergent\backend"
set PYTHONUNBUFFERED=1
"C:\Users\Administrator\Documents\IP_emergent\backend\.venv\Scripts\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8001 > "C:\Users\Administrator\Documents\IP_emergent\backend\backend.log" 2>&1
