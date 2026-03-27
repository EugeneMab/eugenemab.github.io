::@echo off
setlocal
set BASE_DIR=%~dp0
set FOLDER_PATH=%~f1
if "%FOLDER_PATH%"=="" (
    echo no FOLDER_PATH
    exit /b -1
)

if not "%BASE_DIR%"=="%BASE_DIR: =%" (
    echo space in BASE_DIR
    exit /b -1
)

if not "%FOLDER_PATH%"=="%FOLDER_PATH: =%" (
    echo space in FOLDER_PATH
    exit /b -1
)

echo Starting Dating Show Notebook...
echo Project Root: %BASE_DIR%
echo Data Folder: %FOLDER_PARAM%

if not exist node_modules (
    echo Installing root dependencies...
    call npm install
)

if not exist frontend\node_modules (
    echo Installing frontend dependencies...
    pushd frontend
    call npm install
    popd
)

:: Start Backend
cd /d %BASE_DIR%backend
start /min "DSN_Backend" cmd /c npx tsx index.ts %FOLDER_PATH%

:: Start Frontend
cd /d %BASE_DIR%frontend
start /min "DSN_Frontend" cmd /c npx vite

echo.
echo Service is starting...
echo UI: http://localhost:3762/
echo.
