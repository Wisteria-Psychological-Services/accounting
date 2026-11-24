@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24, then run this launcher again.
  pause
  exit /b 1
)
if not exist "node_modules\echarts\package.json" (
  echo Run npm ci in this folder before starting Accounting.
  pause
  exit /b 1
)
echo Open the loopback address printed below. Stop this launcher with Ctrl+C.
call npm run start:web
if errorlevel 1 pause
