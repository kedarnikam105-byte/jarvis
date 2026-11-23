@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules\vite goto not_installed
if not exist node_modules\ws\package.json goto not_installed
start "J.A.R.V.I.S. Windows Companion" "%~dp0start_jarvis_agent.bat"
start "J.A.R.V.I.S. Web App" cmd /k "cd /d ""%~dp0"" && set FIGMA_DEV_SERVER_HOST=127.0.0.1 && npm run dev"
timeout /t 3 /nobreak >nul
start "" http://localhost:8443
goto end
:not_installed
echo Run setup_windows.bat first to install requirements.
pause
:end
endlocal
