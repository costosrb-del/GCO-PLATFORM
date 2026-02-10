@echo off
echo [INFO] Starting Full Deployment (Backend + Frontend)...
echo.

echo [1/2] Deploying Backend to Cloud Run...
cd backend
call gcloud run deploy gco-siigo-api --source . --region us-central1 --project studio-3702398351-4eb21 --allow-unauthenticated --quiet
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend deployment failed!
    cd ..
    exit /b %ERRORLEVEL%
)
cd ..

echo.
echo [2/2] Deploying Frontend to Firebase Hosting...
cd frontend
echo [INFO] Setting Environment Variables...
set NEXT_PUBLIC_API_URL=https://gco-siigo-api-245366645678.us-central1.run.app

echo [INFO] Building Frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    cd ..
    exit /b %ERRORLEVEL%
)

echo [INFO] Deploying to Firebase...
call firebase deploy --only hosting
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend deployment failed!
    cd ..
    exit /b %ERRORLEVEL%
)
cd ..

echo.
echo [SUCCESS] Full Deployment Completed Successfully!
echo.
pause
