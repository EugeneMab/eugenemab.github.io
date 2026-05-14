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

echo [SUCCESS] All checks passed.
endlocal
