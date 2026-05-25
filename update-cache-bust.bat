@echo off
REM Script para atualizar o cache-bust no index.html (Windows)
REM Execute este arquivo quando fizer mudanças nos arquivos CSS/JS

cd /d "%~dp0"
python update-cache-bust.py
pause
