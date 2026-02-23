
import os
import sys

# Force local mode and correct path BEFORE importing app services
os.environ["CACHE_MODE"] = "local"
os.environ["LOCAL_CACHE_DIR"] = r"C:\tmp\gco_local_cache"

# Add current directory to path to ensure imports work
sys.path.append(os.getcwd())

import json
import concurrent.futures
from datetime import datetime, timedelta
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_consolidated_movements
# Import cache AFTER setting env vars
from app.services.cache import cache

# Double check
print(f"Cache Mode: {cache.mode}")
print(f"Cache Dir: {cache.local_dir}")

def get_missing_ranges(dates):
    if not dates:
        return []
    
    dates.sort()
    min_date = datetime.strptime(dates[0], "%Y-%m-%d")
    max_date = datetime.strptime(dates[-1], "%Y-%m-%d")
    
    existing = set(dates)
    
    # Identify gaps > 1 day
    ranges = []
    
    # Optimization: Iterate and find gaps instead of checking every single day (O(N) vs O(Range))
    # Since we have dates sorted, we can just check diff between adjacent dates
    
    date_objs = [datetime.strptime(d, "%Y-%m-%d") for d in dates]
    for i in range(len(date_objs) - 1):
        d1 = date_objs[i]
        d2 = date_objs[i+1]
        diff = (d2 - d1).days
        
        if diff > 1:
            # We have a gap of (diff - 1) days
            # Gap starts at d1 + 1 day
            # Gap ends at d2 - 1 day
            gap_start = d1 + timedelta(days=1)
            gap_end = d2 - timedelta(days=1)
            ranges.append((gap_start.strftime("%Y-%m-%d"), gap_end.strftime("%Y-%m-%d")))
            
    return ranges

def process_company(company):
    c_name = company.get("name")
    if not company.get("valid", True):
        return f"Skipping {c_name} (Invalid)"
        
    print(f"[{c_name}] Checking cache...")
    cache_key = f"history_{c_name}.json"
    data = cache.load(cache_key) or []
    
    if not data:
        # Try finding the file manually if cache.load failed
        manual_path = os.path.join(r"C:\tmp\gco_local_cache", cache_key)
        if os.path.exists(manual_path):
             try:
                 with open(manual_path, 'r', encoding='utf-8') as f:
                     data = json.load(f)
             except:
                 pass

    if not data:
        return f"[{c_name}] No cache data found."
        
    dates = [x.get("date") for x in data if x.get("date")]
    if not dates:
        return f"[{c_name}] Cache empty but file exists."
        
    ranges = get_missing_ranges(dates)
    
    if not ranges:
        return f"[{c_name}] No gaps found."
        
    print(f"[{c_name}] Found {len(ranges)} gaps.")
    
    # Sort by size of gap (descending) to prioritize big holes
    ranges.sort(key=lambda r: (datetime.strptime(r[1], "%Y-%m-%d") - datetime.strptime(r[0], "%Y-%m-%d")).days, reverse=True)
    
    # Take top 5
    target_ranges = ranges[:5]
    
    token = get_auth_token(company["username"], company["access_key"])
    if not token:
        return f"[{c_name}] Auth failed."
        
    total_repaired = 0
    
    for start, end in target_ranges:
        print(f"[{c_name}] Fetching gap: {start} -> {end}")
        try:
            # Fetch ALL types to be safe
            new_data = get_consolidated_movements(token, start, end)
            if new_data:
                # Merge
                data = cache.load(cache_key) or [] # Reload to be safe
                if not data:
                     # Check manual path again
                     manual_path = os.path.join(r"C:\tmp\gco_local_cache", cache_key)
                     if os.path.exists(manual_path):
                         with open(manual_path, 'r', encoding='utf-8') as f:
                             data = json.load(f)
                
                if not data: data = []

                # Filter out overlap from existing (just in case)
                filtered = [x for x in data if not (start <= x.get("date") <= end)]
                
                for m in new_data:
                    if "company" not in m: m["company"] = c_name
                
                filtered.extend(new_data)
                filtered.sort(key=lambda x: x.get("date", ""))
                
                cache.save(cache_key, filtered)
                print(f"[{c_name}] Saved {len(new_data)} records for gap {start}-{end}")
                total_repaired += len(new_data)
            else:
                print(f"[{c_name}] No data found for gap {start}-{end} (True zero sales?)")
        except Exception as e:
            print(f"[{c_name}] Error fetching gap {start}-{end}: {e}")
            
    return f"[{c_name}] Repaired {total_repaired} records across {len(target_ranges)} gaps."

def run_fix():
    companies = get_config()
    # Process sequentially to avoid console gibberish and rate limits
    for c in companies:
        print(process_company(c))

if __name__ == "__main__":
    run_fix()
