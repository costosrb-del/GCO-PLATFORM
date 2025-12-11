from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import concurrent.futures
from app.services.movements import get_consolidated_movements
from app.services.auth import get_auth_token
from app.services.config import get_config

router = APIRouter(prefix="/movements", tags=["movements"])

@router.get("/")
def get_movements(
    start_date: str, 
    end_date: str, 
    types: Optional[List[str]] = Query(None)
):
    companies = get_config()
    if not companies:
        raise HTTPException(status_code=500, detail="No companies configured")

    all_data = []
    errors = []

    def process_company(company):
        try:
            token = get_auth_token(company["username"], company["access_key"])
            if not token:
                return []
            
            # types passed as list of strings, e.g. ["FV", "FC"]
            return get_consolidated_movements(token, start_date, end_date, selected_types=types)
        except Exception as e:
            print(f"Error processing {company["name"]}: {e}")
            return []

    # Parallel execution
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(companies)) as executor:
        future_to_company = {executor.submit(process_company, c): c for c in companies}
        
        for future in concurrent.futures.as_completed(future_to_company):
            res = future.result()
            if res:
                # Add company name to each record for context
                company = future_to_company[future]
                for r in res:
                    r["company"] = company["name"]
                all_data.extend(res)

    return {
        "count": len(all_data),
        "data": all_data
    }
