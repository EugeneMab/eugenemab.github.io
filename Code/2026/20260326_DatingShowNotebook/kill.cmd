@echo off
echo Stopping Dating Show Notebook...
powershell -Command "Invoke-RestMethod -Uri 'http://localhost:13762/api/shutdown' -Method Post"
echo Backend is stopping.
