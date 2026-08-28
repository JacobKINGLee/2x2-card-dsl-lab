@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.13.0 or newer is required.
  echo Install Node.js before running this demo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing project dependencies. Internet access is required this first time.
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Building the local demo...
call npm run build
if errorlevel 1 (
  echo Build failed. Review the messages above.
  pause
  exit /b 1
)

echo Starting http://localhost:3000 ...
start "2x2 Card DSL Local Server" cmd /k "cd /d ""%~dp0"" && npm run demo:local"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(30); while((Get-Date) -lt $deadline){ try { $response=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 1; if($response.StatusCode -ge 200){ Start-Process 'http://localhost:3000'; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"

if errorlevel 1 (
  echo The browser could not be opened automatically.
  echo Open http://localhost:3000 manually after the server is ready.
  pause
)

endlocal
