@echo off
setlocal

title openredou
cd /d "%~dp0"

set "BUN_EXE=bun"

where bun >nul 2>nul
if not errorlevel 1 goto bun_found

if defined BUN_INSTALL if exist "%BUN_INSTALL%\bin\bun.exe" (
  set "BUN_EXE=%BUN_INSTALL%\bin\bun.exe"
  set "PATH=%BUN_INSTALL%\bin;%PATH%"
  goto bun_found
)

if exist "%USERPROFILE%\.bun\bin\bun.exe" (
  set "BUN_EXE=%USERPROFILE%\.bun\bin\bun.exe"
  set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
  goto bun_found
)

if errorlevel 1 (
  echo [openredou] Bun was not found in PATH.
  echo [openredou] Install Bun, then run this launcher again.
  echo [openredou] https://bun.sh
  echo.
  pause
  exit /b 1
)

:bun_found

if not exist "node_modules\" (
  echo [openredou] Dependencies are missing. Running bun install...
  call "%BUN_EXE%" install
  if errorlevel 1 (
    echo.
    echo [openredou] bun install failed.
    pause
    exit /b 1
  )
)

if exist "packages\desktop\node_modules\electron\install.js" if not exist "packages\desktop\node_modules\electron\dist\electron.exe" (
  echo [openredou] Electron binary is missing. Installing Electron...
  call "%BUN_EXE%" "packages\desktop\node_modules\electron\install.js"
  if errorlevel 1 (
    echo.
    echo [openredou] Electron install failed.
    pause
    exit /b 1
  )
)

if not defined OPENCODE_CHANNEL (
  set "OPENCODE_CHANNEL=dev"
)

echo [openredou] Starting desktop app...
echo [openredou] Keep this window open while openredou is running.
echo.

call "%BUN_EXE%" run dev:desktop
set "openredou_exit=%ERRORLEVEL%"

echo.
if "%openredou_exit%"=="0" (
  echo [openredou] Desktop app closed.
) else (
  echo [openredou] Launcher exited with code %openredou_exit%.
)
pause

exit /b %openredou_exit%
