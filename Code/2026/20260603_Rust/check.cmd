@echo off
REM Rust-to-WASM Port (RUST)
echo Running Full Check...
echo [1/5] Formatting...
call npm run format
if %errorlevel% neq 0 goto :fail
echo [2/5] Linting...
call npm run lint
if %errorlevel% neq 0 goto :fail
echo [3/5] Building...
call npm run build
if %errorlevel% neq 0 goto :fail
echo [4/5] Testing...
call npm run test
if %errorlevel% neq 0 goto :fail
echo [5/5] UI Testing...
call npm run test:ui
if %errorlevel% neq 0 goto :fail
echo All checks passed.
exit /b 0

:fail
echo Check failed!
exit /b %errorlevel%
