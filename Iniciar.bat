@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
set /p TTUSER=Usuario do TikTok (sem @, ENTER para modo teste):
start "" http://localhost:8080
start "" http://localhost:8080/admin.html
node server.js %TTUSER%
pause
