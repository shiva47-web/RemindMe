@echo off

title RemindMe Startup

set "PROJECT_DIR=C:\Users\shiva\OneDrive\Desktop\RemindMe"

echo Starting RemindMe...

if not exist "%PROJECT_DIR%\backend\.venv\Scripts\python.exe" (
    echo Backend Python environment not found.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%\frontend\package.json" (
    echo Frontend project not found.
    pause
    exit /b 1
)

echo Starting FastAPI backend...

start "RemindMe Backend" /min /D "%PROJECT_DIR%\backend" "%PROJECT_DIR%\backend\.venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000

timeout /t 3 /nobreak >nul

echo Starting frontend...

start "RemindMe Frontend" /min /D "%PROJECT_DIR%\frontend" cmd.exe /c npm run preview -- --host 127.0.0.1

echo RemindMe services started.
exit /b 0