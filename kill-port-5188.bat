@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5188') do taskkill /PID %%a /F
