@echo off
echo Running tests...
call npm run test
if %errorlevel% neq 0 (
    echo Tests failed!
    exit /b %errorlevel%
)
echo All tests passed.
