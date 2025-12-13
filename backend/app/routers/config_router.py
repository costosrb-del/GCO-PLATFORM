from fastapi import APIRouter, Depends
from app.services.config import get_config
from app.routers.auth_router import verify_token

router = APIRouter(prefix="/config", tags=["config"])

@router.get("/companies")
def get_available_companies(user: dict = Depends(verify_token)):
    """
    Returns a list of configured company names.
    """
    companies = get_config()
    # Only return names, not credentials
    return [c["name"] for c in companies if c.get("name")]
