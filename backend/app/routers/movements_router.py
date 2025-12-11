from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import date
from app.services.movements import get_consolidated_movements as fetch_movements
from app.services.config import get_config
from app.services.auth import get_auth_token
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

        all_results = []
        errors = []

        # Iterate over each company to fetch its data
        for company in target_companies:
            try:
                # Check config validity
                if not company.get("valid", True):
                    msg = f"Config Incompleta: {company['name']}"
                    errors.append(msg)
                    print(msg)
                    continue

                # Authenticate and get session token
                company_username = company.get("username")
                company_access_key = company.get("access_key")
                company_name = company.get("name")
                
                print(f"Authenticating {company_name}...")
                real_token = get_auth_token(company_username, company_access_key)
                
                if not real_token:
                    msg = f"Auth Fallida: {company_name}"
                    errors.append(msg)
                    print(msg)
                    continue
                    
                print(f"Fetching movements for {company_name}...")
                
                # Fetch data
                movs = fetch_movements(real_token, start_date, end_date)
                
                # Tag each record with the company name to distinguish them
                for m in movs:
                    m["company"] = company_name
                    
                all_results.extend(movs)
            except Exception as e:
                import traceback
                traceback.print_exc()
                msg = f"Error fetching for {company.get('name')}: {str(e)}"
                errors.append(msg)
                print(msg)
                continue
        
        # Convert list to DataFrame for final processing
        if not all_results:
             return {"count": 0, "data": [], "errors": errors}
             
        df = pd.DataFrame(all_results)
             
        # Convert NaN to None for JSON compliance
        data = df.where(pd.notnull(df), None).to_dict(orient="records")
        return {"count": len(data), "data": data, "errors": errors}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

