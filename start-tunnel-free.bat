@echo off
title GT02A TCP Tunnel - Serveo (Gratis Murni TCP Tanpa Kartu Kredit)
echo =======================================================================
echo   Membuka Tunnel Publik TCP Port 7018 untuk GT02A via Serveo...
echo   (Murni TCP, Tanpa Kartu Kredit, Sangat Mudah)
echo =======================================================================
echo.
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 0:localhost:7018 serveo.net
pause
