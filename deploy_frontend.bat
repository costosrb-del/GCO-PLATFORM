@echo off
echo [INFO] Deploying Frontend to Firebase Hosting...
echo.

cd frontend

echo [1/3] Setting Production Environment Variables...
set NEXT_PUBLIC_API_URL=https://gco-siigo-api-245366645678.us-central1.run.app

echo [2/3] Building Next.js App...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed!
    exit /b %ERRORLEVEL%
)

echo [3/3] Deploying to Firebase...
call firebase deploy --only hosting
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Deployment failed!
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] Frontend Deployed Successfully!
echo.
pause
