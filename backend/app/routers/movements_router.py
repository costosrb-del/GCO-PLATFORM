from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import date
from app.services.movements import get_consolidated_movements as fetch_movements
from app.services.config import get_config
from app.routers.auth_router import verify_token
import pandas as pd

router = APIRouter(prefix="/movements", tags=["movements"])

@router.get("/")
def get_movements(
    token: str = Depends(verify_token),
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    companies: Optional[List[str]] = Query(None)
):
    try:
        # Load all companies config
        all_companies = get_config()
        
        # Filter if user selected specific companies
        if companies:
            target_companies = [c for c in all_companies if c["name"] in companies]
        else:
            target_companies = all_companies

        if not target_companies:
            return {"count": 0, "data": []}

        # Fetch data using existing logic
        # Note: fetch_movements returns a DataFrame, convert to dict
        df = fetch_movements(target_companies, start_date, end_date)
        
        if df.empty:
             return {"count": 0, "data": []}
             
        # Convert NaN to None for JSON compliance
        data = df.where(pd.notnull(df), None).to_dict(orient="records")
        return {"count": len(data), "data": data}
        
    except Exception as e:
        print(f"Error fetching movements: {e}")
        raise HTTPException(status_code=500, detail=str(e))

