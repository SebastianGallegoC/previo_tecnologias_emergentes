@echo off
title TransCúcuta (UberBuses) - Servidor Local
echo ============================================================
echo   Iniciando TransCúcuta (UberBuses) - PWA Transporte
echo ============================================================
echo.
echo Servidor web corriendo en http://localhost:5173
echo.
start http://localhost:5173
python -m http.server 5173 --directory dist
pause
