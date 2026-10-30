@echo off
title GPTR TV Web Application
echo ========================================================
echo Starting GPTR TV Web Application on http://localhost:5145 ...
echo ========================================================
start http://localhost:5145
cd /d "%~dp0"
python server.py
pause
