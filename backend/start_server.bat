@echo off
echo ==========================================
echo    GCO PLATFORM - BACKEND STARTER
echo ==========================================

echo [1/2] Installing required libraries...
python -m pip install --user fastapi uvicorn requests python-dotenv pandas openpyxl

echo.
echo [2/2] Starting Backend Server...
echo If this closes immediately, there is an error.
echo.

python run.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    echo ERROR: The server crashed or could not start.
    echo Please check the error message above.
    echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    pause
)
