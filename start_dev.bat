@echo off
echo ==========================================
echo    GCO PLATFORM - LOCAL DEV ENVIRONMENT
echo ==========================================
echo.
echo [INFO] Starting Backend...
start "GCO Backend" cmd /k "cd backend && start_server.bat"

echo [INFO] Starting Frontend...
start "GCO Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo [INFO] Environment started!
echo backend: http://localhost:8000
echo frontend: http://localhost:3000
echo.
echo Please wait for the services to initialize...
timeout /t 5
start http://localhost:3000
