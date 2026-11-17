@echo off
chcp 65001 >nul
echo ============================================
echo  Corrida do Saber - gerar instalador (Windows)
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e rode de novo.
  pause
  exit /b 1
)
echo Instalando dependencias (precisa de internet, so na primeira vez)...
call npm install
if errorlevel 1 ( echo [ERRO] Falha no npm install. & pause & exit /b 1 )
echo.
echo Gerando o instalador...
call npm run dist
if errorlevel 1 ( echo [ERRO] Falha ao gerar o instalador. & pause & exit /b 1 )
echo.
echo Pronto! O instalador esta na pasta "dist":
dir /b dist\*.exe
echo.
pause
