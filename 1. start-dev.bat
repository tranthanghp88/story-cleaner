@echo off
setlocal
cd /d %~dp0

title Story Cleaner Dev

echo ======================================
echo   Story Cleaner EPUB Builder - DEV
echo ======================================
echo.
echo Port: 5188
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay NodeJS. Hay cai NodeJS truoc.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay npm. Hay cai NodeJS ban LTS.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Dang cai thu vien lan dau...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install that bai.
    pause
    exit /b 1
  )
)

echo Dang mo app desktop...
call npm run dev
pause
