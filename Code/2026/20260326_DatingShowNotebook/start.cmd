@echo off
set FOLDER=%~1
if "%FOLDER%"=="" set FOLDER=.

echo Starting Dating Show Notebook with folder: %FOLDER%

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

if not exist frontend\node_modules (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

start /b npx tsx backend/index.ts "%FOLDER%"
start /b npx vite frontend

echo Service is starting...
echo UI: http://localhost:3762/
pause
