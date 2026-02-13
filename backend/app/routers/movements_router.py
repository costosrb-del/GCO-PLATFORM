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
    doc_types: Optional[List[str]] = Query(None),
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
                
                # 3. Determine Date Boundaries in Cache
                min_cache_date = "2999-12-31"
                max_cache_date = "1900-01-01"
                
                if db_data:
                    valid_dates = [x['date'] for x in db_data if x.get('date')]
                    if valid_dates:
                        min_cache_date = min(valid_dates)
                        max_cache_date = max(valid_dates)
                else:
                    # Empty cache behavior
                    min_cache_date = "2999-12-31" 
                    max_cache_date = "1900-01-01"

                # 4. Logic: Smart Gap Detection (Hole Filling)
                fetch_ranges = [] 
                
                if force_refresh:
                    # ... Existing Force Refresh Logic ...
                    print(f"[{c_name}] Forcing refresh: {start_date} to {end_date} (Yearly Chunking)")
                    try:
                        sy = int(start_date[:4])
                        ey = int(end_date[:4])
                        for y in range(sy, ey + 1):
                            chunk_start = f"{y}-01-01"
                            chunk_end = f"{y}-12-31"
                            if chunk_start < start_date: chunk_start = start_date
                            if chunk_end > end_date: chunk_end = end_date
                            fetch_ranges.append((chunk_start, chunk_end))
                    except:
                         fetch_ranges.append((start_date, end_date))
                
                else:
                    # NEW ROBUST LOGIC: Check for specific missing months (Holes)
                    # Instead of trusting Min/Max, we verify if we have data for each requested month.
                    
                    try:
                        # 1. Map existing content by YYYY-MM
                        existing_months = set()
                        if db_data:
                            # Optimize: Check first and last to see if we even need to scan? No, scan is safer.
                            # O(N) scan. N ~ 50k. Fast enough (ms).
                            existing_months = {x['date'][:7] for x in db_data if x.get('date')}
                        
                        from datetime import datetime, timedelta
                        from dateutil.relativedelta import relativedelta
                        
                        req_start = datetime.strptime(start_date, "%Y-%m-%d")
                        req_end = datetime.strptime(end_date, "%Y-%m-%d")
                        
                        # Normalize to Month Start for iteration
                        curr = req_start.replace(day=1) 
                        target_end = req_end.replace(day=1)
                        
                        missing_months_start = None
                        
                        while curr <= target_end:
                            month_key = curr.strftime("%Y-%m")
                            
                            # Check if this month is missing
                            if month_key not in existing_months:
                                if missing_months_start is None:
                                    missing_months_start = curr
                            else:
                                # We found data! Close previous gap if exists
                                if missing_months_start:
                                    # End of gap is LAST DAY of PREVIOUS month
                                    gap_end_date = curr - timedelta(days=1)
                                    
                                    # Clamp start
                                    g_start_str = missing_months_start.strftime("%Y-%m-%d")
                                    if missing_months_start.year == req_start.year and missing_months_start.month == req_start.month:
                                        if g_start_str < start_date: g_start_str = start_date
                                        
                                    g_end_str = gap_end_date.strftime("%Y-%m-%d")
                                    if g_end_str > end_date: g_end_str = end_date
                                    
                                    print(f"[{c_name}] Hole Detected: {g_start_str} -> {g_end_str}")
                                    fetch_ranges.append((g_start_str, g_end_str))
                                    missing_months_start = None
                            
                            # Next month
                            curr += relativedelta(months=1)
                        
                        # Close final gap if open
                        if missing_months_start:
                            # End of range
                            last_day_of_req = req_end
                            
                            g_start_str = missing_months_start.strftime("%Y-%m-%d")
                            if missing_months_start.year == req_start.year and missing_months_start.month == req_start.month:
                                if g_start_str < start_date: g_start_str = start_date
                                
                            g_end_str = last_day_of_req.strftime("%Y-%m-%d")
                            
                            print(f"[{c_name}] Missing Range (End): {g_start_str} -> {g_end_str}")
                            fetch_ranges.append((g_start_str, g_end_str))
                            
                    except Exception as e:
                        print(f"Error in Smart Hole Detection: {e}")
                        # Fallback: Fetch everything requested
                        fetch_ranges.append((start_date, end_date))

                if not fetch_ranges:
                     print(f"[{c_name}] Cache Complete. No holes found in range.")

                # 5. Fetching Gaps
                auth_token = None
                new_data_found = False
                
                for r_start, r_end in fetch_ranges:
                    # Safety check
                    if r_start >= r_end: continue

                    if not auth_token:
                        auth_token = get_auth_token(company.get("username"), company.get("access_key"))
                        if not auth_token: 
                            errors.append(f"Auth Fallida: {c_name}")
                            break

                    print(f"[{c_name}] Fetching Gap: {r_start} to {r_end}...")
                    # PASS doc_types FILTER HERE
                    gap_data = fetch_movements(auth_token, r_start, r_end, selected_types=doc_types)
                    
                    if gap_data:
                        # Tag
                        for m in gap_data: m["company"] = c_name
                        
                        # Merge immediately to memory list
                        # Filter overlap for this specific gap to be safe (Clean overwrite)
                        db_data = [x for x in db_data if not (r_start <= x['date'] <= r_end)]
                        db_data.extend(gap_data)
                        
                        # Checkpoint: Save IMMEDIATELY after each chunk
                        # This ensures that if 2020-2023 flows work but 2024 fails/times out, 
                        # we still persisted the first 4 years. User can just retry to get the rest.
                        if True:
                             db_data.sort(key=lambda x: x['date'])
                             cache.save(cache_key, db_data)
                             print(f"[{c_name}] Checkpoint saved for {r_start}-{r_end}")
                        
                        new_data_found = True
                    else:
                         print(f"[{c_name}] Gap {r_start}-{r_end} was empty on Server.")

                # 6. Save Final (if not forced, or just to be sure)
                if new_data_found and not force_refresh:
                    db_data.sort(key=lambda x: x['date'])
                    cache.save(cache_key, db_data)
                
                # 7. Final Filter (Return only what user asked for)
                filtered_response = [x for x in db_data if start_date <= x['date'] <= end_date]
                
                # NEW: Filter by Doc Type if requested (Consistency for Cache)
                if doc_types:
                     # doc_types is a list like ['FV', 'FC']
                     filtered_response = [x for x in filtered_response if x.get('doc_type') in doc_types]

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
                if data: 
                    all_results.extend(data)
                if err: 
                    errors.append(err)

        if not all_results and errors:
             return {"count": 0, "data": [], "errors": errors, "status": "partial_error"}
             
        # cleanup
        if all_results:
            df = pd.DataFrame(all_results)
            final_data = df.where(pd.notnull(df), None).to_dict(orient="records")
            return {"count": len(final_data), "data": final_data, "errors": errors}
        
        return {"count": 0, "data": [], "errors": errors}

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
class SyncRequest(BaseModel):
    years: List[int]

@router.post("/sync")
def sync_movements(
    request: SyncRequest,
    token: str = Depends(verify_token)
):
    """
    Trigger a background sync for specific years.
    This effectively builds the 'Data Warehouse' by fetching full historical years
    and merging them into the master cache file.
    """
    try:
        all_companies = get_config()
        # Filter only valid companies
        target_companies = [c for c in all_companies if c.get("valid", True)]
        
        results = []
        
        def process_sync(company, year):
            c_name = company.get("name")
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            
            # If current year, cap at today to avoid future dates error
            if year == datetime.now().year:
                end_date = datetime.now().strftime("%Y-%m-%d")
                
            try:
                print(f"[{c_name}] Syncing Year {year}...")
                
                # Fetch FULL year
                auth_token = get_auth_token(company.get("username"), company.get("access_key"))
                if not auth_token:
                    return f"Auth Failed: {c_name}"

                new_data = fetch_movements(auth_token, start_date, end_date)
                if not new_data:
                    return f"No data for {c_name} in {year}"

                # Tag with company
                for m in new_data: m["company"] = c_name

                # Load Master Cache
                cache_key = f"history_{c_name}.json" 
                db_data = cache.load(cache_key) or []
                
                # MERGE Strategy:
                # 1. Remove all records belonging to this YEAR from current DB
                # 2. Append the freshly fetched year
                
                # Filter out records where 'date' starts with f"{year}-"
                year_prefix = str(year)
                db_data = [x for x in db_data if not x.get('date', '').startswith(year_prefix)]
                
                # Add new
                db_data.extend(new_data)
                
                # Save
                cache.save(cache_key, db_data)
                return f"Success {c_name} {year}: {len(new_data)} records"

            except Exception as e:
                print(f"Error Syncing {c_name} {year}: {e}")
                return f"Error {c_name} {year}: {str(e)}"

        # Run Heavy Sync
        # We process (Company x Year) combinations
        tasks = []
        for c in target_companies:
            for y in request.years:
                tasks.append((c, y))
                
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_to_task = {executor.submit(process_sync, t[0], t[1]): t for t in tasks}
            
            for future in concurrent.futures.as_completed(future_to_task):
                res = future.result()
                results.append(res)
                
        return {"status": "completed", "details": results}

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
def get_sync_status(
    token: str = Depends(verify_token)
):
    """
    Returns the sync status (min date, max date, count) for each company.
    Used for the audit dashboard.
    """
    try:
        all_companies = get_config()
        status_report = []

        for company in all_companies:
            if not company.get("valid", True): continue
            
            c_name = company.get("name")
            cache_key = f"history_{c_name}.json"
            
            # Load cache (Metadata check would be faster, but loading is safer for accuracy)
            db_data = cache.load(cache_key) or []
            
            if db_data:
                valid_dates = [x['date'] for x in db_data if x.get('date')]
                if valid_dates:
                    min_date = min(valid_dates)
                    max_date = max(valid_dates)
                    count = len(db_data)
                else:
                    min_date = "N/A"
                    max_date = "N/A"
                    count = 0
            else:
                min_date = "Sin Datos"
                max_date = "Sin Datos"
                count = 0
                
            status_report.append({
                "company": c_name,
                "min_date": min_date,
                "max_date": max_date,
                "count": count
            })
            
        return status_report

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

