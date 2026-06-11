@echo off
title Story Cleaner Dev

cd /d %~dp0

echo =========================
echo Starting Story Cleaner...
echo =========================
echo.

call npm install
call npm run dev

pause