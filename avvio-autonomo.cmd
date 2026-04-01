@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
  echo Dipendenze non trovate. Avvio installazione...
  call npm install
  if errorlevel 1 (
    echo Installazione fallita. Premi un tasto per chiudere.
    pause >nul
    exit /b 1
  )
)

echo Avvio server Next.js...
start "" "http://localhost:3000"
call npm run dev

endlocal