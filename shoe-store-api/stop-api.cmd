@echo off
rem Stops the Nishoes API: the dev-runner window (if open) and the API process.
echo Stopping the Nishoes API...
taskkill /FI "WINDOWTITLE eq Nishoes API - dev runner*" /T /F >nul 2>&1
taskkill /IM ShoeStore.Api.exe /T /F >nul 2>&1
if errorlevel 1 (echo The API was not running.) else (echo The API has stopped.)
timeout /t 3 >nul
