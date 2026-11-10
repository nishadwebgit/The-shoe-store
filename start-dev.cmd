@echo off
title Nishoes shoe store - dev server
cd /d "%~dp0"
echo Writing a log to dev-server.log
echo ==== %DATE% %TIME% ==== > dev-server.log
where node >nul 2>nul || (echo Node.js was not found. Install Node 22 LTS from https://nodejs.org and run this again. & echo Node.js not found >> dev-server.log & pause & exit /b 1)
for /f %%v in ('node -v') do set NODEVER=%%v
echo Node %NODEVER% >> dev-server.log
echo Node %NODEVER%
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=23?0:1)"
if errorlevel 1 (
  echo.
  echo This project uses Vite 8, which needs Node 20.19+ or 22.12+. You have %NODEVER%.
  echo Install Node 22 LTS from https://nodejs.org, then run this file again.
  echo Unsupported Node %NODEVER% >> dev-server.log
  pause
  exit /b 1
)
if not exist node_modules\.bin\vite.cmd (
  echo Installing dependencies...
  call npm install >> dev-server.log 2>&1 || (echo npm install failed, see dev-server.log & pause & exit /b 1)
)
echo Starting the store on http://localhost:5180 - keep this window open.
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run dev -- --port 5180 --strictPort --open 2>&1 | Tee-Object -FilePath dev-server.log -Append"
echo.
echo The dev server stopped. See dev-server.log for details.
pause
