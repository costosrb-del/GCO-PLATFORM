
import sys
import os
import json
from datetime import datetime, timedelta

# Add the backend directory to sys.path so we can import app modules
# Assuming this script is run from the project root
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.config import get_config
    from app.services.movements import get_consolidated_movements
    from app.services.cache import cache
    from app.services.auth import get_auth_token
    # Force localized path for Windows if running locally and env not set
    if os.name == 'nt' and not os.getenv("LOCAL_CACHE_DIR"):
        cache.local_dir = r"C:\tmp\gco_local_cache"
        print(f"Forced local cache dir to: {cache.local_dir}")

except ImportError as e:
    print(f"Error importing modules: {e}")
    print("Make sure you are running this script from the project root (e.g., python backend/fix_cache_gaps.py)")
    sys.exit(1)

def find_gaps(dates, start_date_str, end_date_str):
    """
    Finds missing dates in a list of dates within a range.
    Returns a list of missing date strings.
    """
    start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date_str, "%Y-%m-%d")
    
    existing_dates = set(dates)
    missing_dates = []
    
    current_dt = start_dt
    while current_dt <= end_dt:
        date_str = current_dt.strftime("%Y-%m-%d")
        if date_str not in existing_dates:
            missing_dates.append(date_str)
        current_dt += timedelta(days=1)
        
    return missing_dates

def group_consecutive_dates(date_strs):
    """
    Groups a list of date strings into consecutive ranges.
    Returns a list of (start_str, end_str) tuples.
    """
    if not date_strs:
        return []
        
    sorted_dates = sorted([datetime.strptime(d, "%Y-%m-%d") for d in date_strs])
    ranges = []
    
    if not sorted_dates:
        return []
        
    range_start = sorted_dates[0]
    prev_date = sorted_dates[0]
    
    for current_date in sorted_dates[1:]:
        if (current_date - prev_date).days > 1:
            # Gap found, close previous range
            ranges.append((range_start.strftime("%Y-%m-%d"), prev_date.strftime("%Y-%m-%d")))
            range_start = current_date
        prev_date = current_date
        
    # Add the last range
    ranges.append((range_start.strftime("%Y-%m-%d"), prev_date.strftime("%Y-%m-%d")))
    
    return ranges

def fix_company_cache(company):
    c_name = company.get("name")
    if not company.get("valid", True):
        print(f"Skipping {c_name} (Invalid Config)")
        return

    hist_key = f"history_{c_name}.json"
    cached_data = cache.load(hist_key) or []
    
    if not cached_data:
        print(f"No cache found for {c_name}. Skipping (Full fetch needed? Run normal process first).")
        return

    # Determine analysis range from the cache itself or a fixed window?
    # analytics.py uses [today-1 - 30 days] by default, checking 20 days.
    # But cache files seem to have much longer history.
    # Let's find the min and max date in the cache, and check for internal gaps.
    
    dates = [m.get("date") for m in cached_data if m.get("date")]
    if not dates:
        print(f"Cache for {c_name} is empty (no dates).")
        return

    dates.sort()
    min_date = dates[0]
    max_date = dates[-1]
    
    print(f"\nAnalyzing {c_name}...")
    print(f"  Range in cache: {min_date} to {max_date}")
    
    # We only care about gaps within the cached range (internal gaps).
    # Extending the range backwards or forwards is a different task (historical fill).
    # Let's focus on fixing internal holes first.
    
    missing_dates = find_gaps(dates, min_date, max_date)
    
    if not missing_dates:
        print(f"  No internal gaps found!")
        return
        
    print(f"  Found {len(missing_dates)} missing days.")
    
    gap_ranges = group_consecutive_dates(missing_dates)
    print(f"  Gaps grouped into {len(gap_ranges)} batches.")
    
    token = get_auth_token(company["username"], company["access_key"])
    if not token:
        print(f"  [ERROR] Failed to get token for {c_name}")
        return

    total_added = 0
    
    for start_gap, end_gap in gap_ranges:
        print(f"  -> Fetching gap: {start_gap} to {end_gap} ...")
        
        # Fetch ALL types to be safe and complete
        new_data = get_consolidated_movements(
            token, 
            start_gap, 
            end_gap, 
            progress_callback=None, 
            selected_types=None # Fetch ALL
        )
        
        if new_data:
             # Tag company
             for m in new_data:
                 if "company" not in m:
                     m["company"] = c_name
             
             cached_data.extend(new_data)
             total_added += len(new_data)
             print(f"     Fetched {len(new_data)} records.")
        else:
             print(f"     No data found in API for this range (it was truly empty?).")

    # De-duplicate and Sort
    # Use a dictionary keyed by unique ID if possible, or (date, doc_type, doc_number, code)
    # A simple way is to re-sort and overwrite.
    # Be careful not to duplicate existing records if we fetched overlapping ranges (we shouldn't have).
    
    # To be safe, remove duplicates based on a composite key
    seen = set()
    unique_data = []
    # Sort first to ensure determinism
    cached_data.sort(key=lambda x: (x.get("date", ""), x.get("doc_number", ""), x.get("code", "")))
    
    for m in cached_data:
        # Create a unique key. 
        # Note: 'id' might be missing. Use (date, type, number, code, quantity)
        key = (
            m.get("date"), 
            m.get("doc_type"), 
            m.get("doc_number"), 
            m.get("code"), 
            m.get("quantity")
        )
        if key not in seen:
            seen.add(key)
            unique_data.append(m)
            
    print(f"  Saving updated cache for {c_name} (Total records: {len(unique_data)}, Added: {total_added})")
    cache.save(hist_key, unique_data)

def main():
    print("Starting Cache Gap Fixer...")
    companies = get_config()
    
    # Optional: Filter for specific company if passed as arg
    if len(sys.argv) > 1:
        target = sys.argv[1]
        companies = [c for c in companies if target.lower() in c["name"].lower()]
        
    for company in companies:
        try:
            fix_company_cache(company)
        except Exception as e:
            print(f"Error processing {company.get('name')}: {e}")

if __name__ == "__main__":
    main()
