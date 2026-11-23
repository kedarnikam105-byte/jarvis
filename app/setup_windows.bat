@echo off
setlocal
cd /d "%~dp0"
title J.A.R.V.I.S. Windows Setup
where node >nul 2>nul
if errorlevel 1 goto install_node
node -e "const [M,m]=process.versions.node.split('.').map(Number); process.exit((M===20&&m>=19)||(M===22&&m>=12)||M>22?0:1)"
if errorlevel 1 goto install_node
goto node_ready

:install_node
where winget >nul 2>nul
if errorlevel 1 goto node_missing
echo Installing Node.js LTS using Windows Package Manager...
winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto node_missing
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%PATH%"
node -e "const [M,m]=process.versions.node.split('.').map(Number); process.exit((M===20&&m>=19)||(M===22&&m>=12)||M>22?0:1)" >nul 2>nul
if errorlevel 1 goto node_missing

:node_ready
where npm >nul 2>nul
if errorlevel 1 goto node_missing
echo Installing web app and Windows companion packages...
npm install
if errorlevel 1 goto failed
echo Setup complete. Double-click run_jarvis.bat to start J.A.R.V.I.S.
pause
exit /b 0

:failed
echo Setup failed. Check internet access, then retry setup_windows.bat.
pause
exit /b 1

:node_missing
echo Node.js could not be installed automatically. Install Node.js LTS or ask your administrator to enable winget, then run this file again.
pause
exit /b 1
