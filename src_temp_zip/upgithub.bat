@echo off
chcp 65001 >nul
title Story Cleaner - Push Github

cd /d %~dp0

echo =====================================
echo      STORY CLEANER GITHUB PUSH
echo =====================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1

if errorlevel 1 (
    echo Khoi tao Git Repository...
    git init
    git branch -M main
    git remote add origin https://github.com/tranthanghp88/story-cleaner.git
)

echo.
git status

echo.
set /p msg=Nhap commit message (Enter = Auto Update): 

if "%msg%"=="" (
    set msg=Auto Update
)

echo.
echo Dang add source...
git add .

echo.
echo Dang commit...
git commit -m "%msg%"

echo.
echo Dang push len Github...
git push -u origin main

echo.
echo =====================================
echo            HOAN THANH
echo =====================================
echo.

pause