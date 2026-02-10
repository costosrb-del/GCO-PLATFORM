@echo off
echo [INFO] Deploying Backend ONLY to Google Cloud Run...
echo.

cd backend
call gcloud run deploy gco-siigo-api --source . --region us-central1 --project studio-3702398351-4eb21 --allow-unauthenticated --quiet

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend deployment failed!
    cd ..
    exit /b %ERRORLEVEL%
)

cd ..
echo [SUCCESS] Backend Deployed Successfully!
echo.
pause
