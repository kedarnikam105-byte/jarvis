@echo off
setlocal
title Install J.A.R.V.I.S. Windows Companion
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto install_node
goto node_ready
:install_node
where winget >nul 2>nul
if errorlevel 1 goto node_missing
echo Installing Node.js LTS using Windows Package Manager...
winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto node_missing
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 goto node_missing
:node_ready
where npm >nul 2>nul
if errorlevel 1 goto node_missing
npm install --prefix "%~dp0" ws@8.23.0
if errorlevel 1 goto failed
echo Companion requirement installed. Run start_jarvis_agent.bat.
pause
exit /b 0
:failed
echo Could not install the WebSocket dependency. Check internet access and npm availability.
pause
exit /b 1
:node_missing
echo Node.js could not be installed. Install Node.js LTS or ask your administrator to enable winget.
pause
exit /b 1
