@echo off
setlocal

rem ==== Configuracion ====
set "PUERTO=8123"
set "CARPETA=app"
set "URL=http://localhost:%PUERTO%"

rem Nos situamos en la carpeta donde esta este .bat,
rem sin importar desde donde se abra
cd /d "%~dp0"

title NutriPlan - servidor local
echo ==========================================
echo    N u t r i P l a n
echo ==========================================
echo.

rem ==== 1. Comprobar que la app esta donde esperamos ====
if not exist "%CARPETA%\index.html" goto sin_app

rem ==== 2. Si ya hay un servidor en el puerto, solo abrir el navegador ====
netstat -an | findstr ":%PUERTO%" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 goto ya_abierto

rem ==== 3. Buscar Python ====
set "PY="
python --version >nul 2>nul && set "PY=python"
if not defined PY py -3 --version >nul 2>nul && set "PY=py -3"
if not defined PY goto sin_python

rem ==== 4. Abrir el navegador con 2 segundos de retraso ====
rem     (para dar tiempo al servidor a ponerse en marcha)
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start %URL%"

rem ==== 5. Arrancar el servidor en esta ventana ====
echo Servidor arrancando en %URL%
echo.
echo   - NO CIERRES ESTA VENTANA mientras uses la app.
echo   - Para apagarlo: pulsa Ctrl+C o cierra esta ventana.
echo.
echo ------------------------------------------
%PY% -m http.server %PUERTO% --directory "%CARPETA%"

echo ------------------------------------------
echo.
echo El servidor se ha detenido.
pause
exit /b 0

:ya_abierto
echo El servidor ya estaba abierto. Abriendo el navegador...
start %URL%
timeout /t 2 /nobreak >nul
exit /b 0

:sin_app
echo [ERROR] No encuentro "%CARPETA%\index.html".
echo.
echo Este archivo .bat tiene que estar en la misma carpeta
echo que la carpeta "%CARPETA%".
echo.
pause
exit /b 1

:sin_python
echo [ERROR] No encuentro Python en este ordenador.
echo.
echo Instalalo desde: https://www.python.org/downloads/
echo IMPORTANTE: marca la casilla "Add Python to PATH" al instalar.
echo.
pause
exit /b 1
