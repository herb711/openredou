@echo off
setlocal

title openredou
cd /d "%~dp0"

where bun >nul 2>nul
if errorlevel 1 (
  echo [openredou] Bun was not found in PATH.
  echo [openredou] Install Bun, then run this launcher again.
  echo [openredou] https://bun.sh
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [openredou] Dependencies are missing. Running bun install...
  call bun install
  if errorlevel 1 (
    echo.
    echo [openredou] bun install failed.
    pause
    exit /b 1
  )
)

echo [openredou] Starting desktop app...
echo [openredou] Keep this window open while openredou is running.
echo.

call bun run dev:desktop
set "openredou_exit=%ERRORLEVEL%"

echo.
if "%openredou_exit%"=="0" (
  echo [openredou] Desktop app closed.
) else (
  echo [openredou] Launcher exited with code %openredou_exit%.
)
pause

exit /b %openredou_exit%
