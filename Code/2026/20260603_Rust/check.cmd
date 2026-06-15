@echo off
REM Rust-to-WASM Port (RUST)
REM Wrapper: launch the actual check runner in a child cmd and kill if it runs longer than 5 minutes (300s)
if "%1"=="run" goto :run
echo Starting timed check (5 minute limit)...
powershell -NoProfile -Command "$child = Start-Process -FilePath '%COMSPEC%' -ArgumentList '/c \"%~f0\" run' -NoNewWindow -PassThru; if (-not $child.WaitForExit(300000)) { Write-Host 'Timeout reached (5m). Killing check process:' $child.Id; Stop-Process -Id $child.Id -Force; Exit 1 }; Exit $child.ExitCode"
exit /b %errorlevel%

:run
pushd "%~dp0"
echo Running Full Check...
echo [1/5] Formatting...
call npm run format
echo [2/5] Linting...
call npm run lint
echo [3/5] Building...
call npm run build
echo [3.5/5] Syncing samples...
xcopy /Y /S samples\*.rs pub\samples\
echo [4/5] Testing...
call npm run test
echo [5/5] UI Testing...
call npm run test:ui
if %errorlevel% neq 0 (
    echo Check failed!
    popd
    exit /b %errorlevel%
)
echo All checks passed.
popd
