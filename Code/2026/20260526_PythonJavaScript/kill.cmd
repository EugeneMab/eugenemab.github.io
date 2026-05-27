@echo off
echo Stopping local server on port 7957...
setlocal
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :7957 ^| findstr LISTENING') do (
    if NOT "%%a" == "" (
        echo Killing process ID %%a
        taskkill /F /PID %%a
    )
)
endlocal
echo Done.
