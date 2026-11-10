@echo off
title Nishoes API - dev runner
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-api.ps1"
pause
