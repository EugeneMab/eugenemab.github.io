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

echo Building project...
call build.cmd
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed.
    exit /b %ERRORLEVEL%
)

echo Running UI Tests...
:: Ensure port is clear before starting
for /f "tokens=5" %%a in ('netstat -aon ^| findstr LISTENING ^| findstr /C:":17957 "') do taskkill /F /PID %%a > nul 2>&1

:: Start server in background on test port
set PORT=17957
start /B node src/serve.js > test_output\server.log 2>&1

:: Wait for server to start
ping 127.0.0.1 -n 5 > nul

call npm run test:ui > test_output\ui.log 2>&1
set UI_RESULT=%ERRORLEVEL%
type test_output\ui.log

:: Kill background server
for /f "tokens=5" %%a in ('netstat -aon ^| findstr LISTENING ^| findstr /C:":17957 "') do taskkill /F /PID %%a > nul 2>&1

if %UI_RESULT% neq 0 (
    echo [ERROR] UI tests failed.
    exit /b %UI_RESULT%
)

echo [SUCCESS] All checks passed.
endlocal
