from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
import logging
from app.services.config import get_config
from app.routers.inventory_router import get_consolidated_inventory
from app.services.email_service import send_daily_report_email
from app.services.movements import get_consolidated_movements
from app.services.auth import get_auth_token
from app.routers.auth_router import verify_token
# from app.services.auth import verify_token <- Incorrect

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger(__name__)

@router.post("/daily-inventory-email")
async def trigger_daily_email_report(background_tasks: BackgroundTasks, secret: str):
    """
    Trigger triggered by Cloud Scheduler.
    Requires a shared secret in query param to prevent unauthorized public access.
    """
    # Simple security check for Cron jobs
    # In Cloud Scheduler, you will add ?secret=YOUR_CHOSEN_SECRET
    env_secret = "GCO_REPORT_SECRET" 
    # For now, let's hardcode a default check or use env var
    # In production, set CRON_SECRET env var
    
    # NOTE: Since this is called by Cloud Scheduler, we can't easily rely on Bearer token
    # unless we configure OIDC. For simplicity, we use a URL secret.
    
    if secret != "super_secret_report_key_123": # We will tell user to set this in scheduler
         raise HTTPException(status_code=401, detail="Invalid secret")

    logger.info("Starting Daily Inventory Report Generation...")

    # Reuse logic from inventory router
    # We pass a dummy user dict because get_consolidated_inventory expects it for filtering,
    # but we want ALL data for the admin report, so we simulate an admin role.
    admin_user = {"role": "admin", "username": "system_cron"}
    
    try:
        # Get Data (Force Refresh to ensure accuracy for the morning report)
        result = get_consolidated_inventory(user=admin_user, force_refresh=True)
        inventory_data = result.get("data", [])
        
        if not inventory_data:
            return {"status": "warning", "message": "No inventory data found to report."}

        # Send Email in Background
        background_tasks.add_task(send_daily_report_email, inventory_data)
        
        return {"status": "success", "message": "Report generation started in background."}
        
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        raise HTTPException(status_code=500, detail=str(e))
