from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime
import concurrent.futures
import pandas as pd
import hashlib
import json

from app.services.movements import get_consolidated_movements as fetch_movements
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.routers.auth_router import verify_token
from app.services.cache import cache

router = APIRouter(prefix="/movements", tags=["movements"])

@router.get("/")
def get_movements(
    token: str = Depends(verify_token),
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    companies: Optional[List[str]] = Query(None),
    force_refresh: bool = Query(False)
):
    try:
        all_companies = get_config()
        if companies:
            target_companies = [c for c in all_companies if c["name"] in companies]
        else:
            target_companies = all_companies

        if not target_companies:
            return {"count": 0, "data": []}

        all_results = []
        errors = []

        def process_company(company):
            c_name = company.get("name")
            try:
                # 1. Config Check
                if not company.get("valid", True):
                    return [], f"Config Incompleta: {c_name}"

                # 2. Cache Loading (Master History File)
                cache_key = f"history_{c_name}.json" 
                db_data = cache.load(cache_key) or []
                
                # 3. Determine Max Date avail in Cache
                # Initialize with a very old date or matching start_date logic
                max_cache_date = "2020-01-01"
                if db_data:
                    valid_dates = [x['date'] for x in db_data if x.get('date')]
                    if valid_dates:
                        max_cache_date = max(valid_dates)

                # 4. Logic: Do we need to fetch?
                fetch_needed = False
                fetch_start = start_date
                fetch_end = end_date
                
                if force_refresh:
                    fetch_needed = True
                    # Fetch exactly what user asked (to fix holes or updates)
                    fetch_start = start_date
                    print(f"[{c_name}] Forcing refresh: {fetch_start} to {fetch_end}")
                    
                elif end_date > max_cache_date:
                    fetch_needed = True
                    # Optimization: Only fetch from last known date
                    # If cache has up to Jan 31, and we want Feb 28.
                    # Fetch from Jan 31 (overlap) to Feb 28.
                    # If cache is empty (2020), fetch user start_date.
                    # Ensure we don't go backwards if user asks for OLD data not in cache
                    # (For this logic, we assume we fill forward. If user asks older than cache, we fetch it too)
                    
                    if start_date > max_cache_date:
                        # Gap detected or simple forward fill
                        fetch_start = max(start_date, max_cache_date)
                    else:
                        # User wants old data + new data?
                        # If start_date < max_cache_date < end_date.
                        # We already have start..max. We need max..end.
                        fetch_start = max_cache_date
                        
                    print(f"[{c_name}] Incremental fetch: {fetch_start} to {fetch_end} (Cache Max: {max_cache_date})")
                else:
                    print(f"[{c_name}] Served fully from cache.")

                # 5. Fetching
                if fetch_needed:
                    auth_token = get_auth_token(company.get("username"), company.get("access_key"))
                    if not auth_token:
                        return [], f"Auth Fallida: {c_name}"

                    new_data = fetch_movements(auth_token, fetch_start, fetch_end)
                    
                    if new_data:
                        # Tag with company
                        for m in new_data: m["company"] = c_name
                        
                        # 6. Merge / Upsert
                        # Strategy: Remove overlaps in the *fetched range* from existing DB, then append.
                        # This avoids duplicates if we re-fetched an existing month.
                        
                        # Filter out existing records that fall within the new fetch window
                        # (To be replaced by the fresh data)
                        db_data = [x for x in db_data if not (fetch_start <= x['date'] <= fetch_end)]
                        
                        # Append new data
                        db_data.extend(new_data)
                        
                        # Save updated History
                        cache.save(cache_key, db_data)
                    else:
                        print(f"[{c_name}] No new data returned from API.")
                
                # 7. Final Filter (Return only what user asked for)
                filtered_response = [x for x in db_data if start_date <= x['date'] <= end_date]
                return filtered_response, None

            except Exception as e:
                print(f"Error {c_name}: {e}")
                # import traceback; traceback.print_exc()
                return [], f"Error {c_name}: {str(e)}"

        # Parallel Execution
        # We use threads because I/O bound (Network + Disk/Cloud Storage)
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(target_companies)+1)) as executor:
            future_to_c = {executor.submit(process_company, c): c for c in target_companies}
            
            for future in concurrent.futures.as_completed(future_to_c):
                data, err = future.result()
                if data: all_results.extend(data)
                if err: errors.append(err)

        if not all_results:
             return {"count": 0, "data": [], "errors": errors}
             
        # cleanup
        df = pd.DataFrame(all_results)
        final_data = df.where(pd.notnull(df), None).to_dict(orient="records")
        return {"count": len(final_data), "data": final_data, "errors": errors}

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
