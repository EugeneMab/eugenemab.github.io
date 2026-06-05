@echo off
REM Rust-to-WASM Port (RUST)
echo Stopping local server on port 7878...
setlocal
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :7878 ^| findstr LISTENING') do (
    if NOT "%%a" == "" (
        echo Killing process ID %%a
        taskkill /F /PID %%a
    )
)
endlocal
echo Done.
