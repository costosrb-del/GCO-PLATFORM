from fastapi import APIRouter, Depends, HTTPException
from app.services.auth import get_auth_token
from app.routers.auth_router import verify_token
from app.services.juego_service import calculate_inventory_game
from app.services.config import get_config
import logging

router = APIRouter(prefix="/juego-inventario", tags=["juego-inventario"])
logger = logging.getLogger(__name__)

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
        data = calculate_inventory_game(siigo_token)
        
        return {"data": data}
        
    except Exception as e:
        logger.error(f"Error in juego-inventario: {e}")
        raise HTTPException(status_code=500, detail=str(e))
