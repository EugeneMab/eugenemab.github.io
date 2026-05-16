@echo off
setlocal

echo Running Prettier...
call npx prettier --write src/**/*.ts
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo Running ESLint...
call npx eslint src/**/*.ts --max-warnings 0
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo Running Unit Tests with Coverage...
if not exist test_output mkdir test_output
call npm test > test_output\test.log 2>&1
set TEST_RESULT=%ERRORLEVEL%
type test_output\test.log

if %TEST_RESULT% neq 0 (
    echo [ERROR] Unit tests failed.
    exit /b %TEST_RESULT%
)

echo Running UI Tests...
:: Start server in background on test port
set PORT=7895
start /B node src/serve.js > test_output\server.log 2>&1
:: Wait for server to start
timeout /t 2 > nul
call npm run test:ui > test_output\ui.log 2>&1
set UI_RESULT=%ERRORLEVEL%
echo UI test log: test_output\ui.log

:: Kill background server
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :7895') do taskkill /F /PID %%a > nul 2>&1

if %UI_RESULT% neq 0 (
    echo [ERROR] UI tests failed.
    exit /b %UI_RESULT%
)

echo [SUCCESS] All checks passed.
endlocal
