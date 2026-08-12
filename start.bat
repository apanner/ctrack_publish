@echo off
title ctrack
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed or not in PATH. Please install Node.js.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
)

echo Starting ctrack...
echo.
call npm run dev

echo.
if errorlevel 1 (
    echo App exited with an error.
) else (
    echo App closed.
)
pause
