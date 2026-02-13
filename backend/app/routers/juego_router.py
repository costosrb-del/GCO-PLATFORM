from fastapi import APIRouter, Depends, HTTPException
from app.services.auth import get_auth_token
from app.routers.auth_router import verify_token
from app.services.juego_service import calculate_inventory_game
from app.services.config import get_config
import logging

router = APIRouter(prefix="/juego-inventario", tags=["juego-inventario"])
logger = logging.getLogger(__name__)

@router.get("/status")
def get_juego_status(token: str = Depends(verify_token)):
    """
    Returns the current active month being processed.
    """
    from app.services.juego_service import get_juego_state
    return get_juego_state()

@router.post("/close")
def close_month(token: str = Depends(verify_token), company_index: int = 0):
    """
    Finalizes the current month, returns the data for export, and advances the active month.
    """
    try:
        from app.services.juego_service import calculate_inventory_game, get_juego_state, save_juego_state
        from datetime import datetime
        from dateutil.relativedelta import relativedelta
        
        # 1. Get current data for the final report
        companies = get_config()
        if company_index < 0 or company_index >= len(companies):
             raise HTTPException(status_code=400, detail="Invalid company index")
             
        target_company = companies[company_index]
        siigo_token = get_auth_token(target_company["username"], target_company["access_key"])
        
        # Calculate final numbers for the closing month
        data, errors = calculate_inventory_game(siigo_token)
        
        # 2. Advance the month in state
        current_state = get_juego_state()
        curr_y, curr_m = map(int, current_state["active_month"].split("-"))
        
        if curr_m == 12:
            new_y = curr_y + 1
            new_m = 1
        else:
            new_y = curr_y
            new_m = curr_m + 1
            
        new_month_str = f"{new_y:04d}-{new_m:02d}"
        save_juego_state(new_month_str)
        
        return {
            "data": data, 
            "errors": errors, 
            "closed_month": current_state["active_month"],
            "new_month": new_month_str
        }
        
    except Exception as e:
        logger.error(f"Error closing month: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
def get_inventory_game(token: str = Depends(verify_token), company_index: int = 0):
    """
    Get Inventory Game Report: Initial + Entries (Sheet) - Exits (Siigo FV-NC)
    """
    try:
        # We need a Siigo Token. `verify_token` verifies the JWT from frontend.
        # But we need to communicate with Siigo API using the Company's credentials.
        # Usually, `movements.py` expects a valid Siigo Token.
        
        # 1. Get Company Credentials
        companies = get_config()
        if not companies:
             raise HTTPException(status_code=500, detail="No company configuration found")
             
        # For now, default to the first company or let user select?
        # The prompt implies "ME TRAIGA NC", likely referring to the active company context.
        # But `movements.get_consolidated_movements` takes a *Siigo Token*.
        # Let's use the provided `company_index` to select which company to fetch exits for.
        
        if company_index < 0 or company_index >= len(companies):
             raise HTTPException(status_code=400, detail="Invalid company index")
             
        target_company = companies[company_index]
        
        # 2. Get Siigo Token
        siigo_token = get_auth_token(target_company["username"], target_company["access_key"])
        if not siigo_token:
             raise HTTPException(status_code=401, detail="Failed to authenticate with Siigo")
             
        # 3. Calculate
        data, errors = calculate_inventory_game(siigo_token)
        
        return {"data": data, "errors": errors}
        
    except Exception as e:
        logger.error(f"Error in juego-inventario: {e}")
        raise HTTPException(status_code=500, detail=str(e))
