@echo off
title Elephant Tracking System - 1-Click Launcher
echo =======================================================================
echo   Menjalankan Elephant Tracking System (GT02A / XY03D-1-09404)
echo =======================================================================
echo.

echo [1/3] Menyalakan Backend NestJS (Port 3000 ^& TCP 7018)...
start "Backend - Elephant Tracking (Port 3000 & 7018)" cmd /k "cd /d "%~dp0" && npm run start:dev"

echo [2/3] Menyalakan Frontend React + Vite + Leaflet (Port 5173)...
start "Frontend - Elephant Tracking (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [3/3] Menunggu server siap (5 detik), lalu membuka browser otomatis...
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo ✅ Selesai! Backend, Frontend, dan Browser sudah dibuka.
timeout /t 3 >nul
