@echo off
setlocal DisableDelayedExpansion
title CTRACK PUBLISH - PORTABLE RUNNER

:: Get the directory where the batch file is located
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

echo ==========================================================
echo    CTRACK PUBLISH V2 - PORTABLE RUNNER
echo ==========================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if errorlevel 1 goto NO_NODE

:: Check for node_modules
if not exist "node_modules\" goto INSTALL_DEPS

:START_APP
echo [INFO] Environment Ready.
echo [INFO] Port: 3001
echo [INFO] Launching CTrack Publish Engine...
echo.

:: Run the development server
:: We use 'call' to ensure the batch script doesn't exit prematurely
call npm run dev

if errorlevel 1 goto APP_ERROR
goto END

:NO_NODE
echo [ERROR] Node.js is not installed or not in PATH.
echo Please install Node.js (LTS) to run this application.
pause
exit /b 1

:INSTALL_DEPS
echo [WARNING] node_modules not found.
echo Attempting to install dependencies...
echo.
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
goto START_APP

:APP_ERROR
echo.
echo [CRITICAL] Application exited with error code %errorlevel%
pause
exit /b 1

:END
exit /b 0
