@echo off
chcp 65001 >nul
title Build Story Cleaner Portable

cd /d %~dp0

echo ========================================
echo  Story Cleaner - Build Portable
echo ========================================
echo.
echo Buoc 1/3: Xoa build cu...
if exist dist rmdir /s /q dist
if exist release rmdir /s /q release

echo.
echo Buoc 2/3: Cai/cap nhat package...
call npm install --legacy-peer-deps --registry=https://registry.npmjs.org/
if errorlevel 1 (
  echo.
  echo Loi npm install. Hay kiem tra mang hoac thu lai sau.
  pause
  exit /b 1
)

echo.
echo Buoc 3/3: Build portable...
call npm run dist:portable
if errorlevel 1 (
  echo.
  echo Build that bai. Hay xem log phia tren.
  pause
  exit /b 1
)

echo.
echo Build xong!
echo File Portable nam trong thu muc release.
echo.
pause
