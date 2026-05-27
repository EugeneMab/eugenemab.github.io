@echo off
setlocal
cd /d "%~dp0"

if not exist pub\js mkdir pub\js

echo Building TypeScript...
call node_modules\.bin\tsc -p tsconfig.json
if %ERRORLEVEL% neq 0 (
    echo Build failed.
    exit /b %ERRORLEVEL%
)

echo Cleaning up...
del /q pub\js\*.js.map >nul 2>nul
del /q pub\js\*.test.js >nul 2>nul
del /q pub\js\vitest.* >nul 2>nul
del /q pub\js\*.vitest.test.js >nul 2>nul

echo Build successful.
