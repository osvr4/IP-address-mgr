@echo off
cd /d "C:\Users\Administrator\Documents\IP_emergent\frontend"
set BROWSER=none
set PORT=3000
"C:\Program Files\nodejs\node.exe" "node_modules\@craco\craco\dist\bin\craco.js" start > "C:\Users\Administrator\Documents\IP_emergent\frontend\frontend.log" 2>&1
