
import os
import json
from datetime import datetime, timedelta

CACHE_DIR = r"C:\tmp\gco_local_cache"

def check_cache_gaps():
    files = [f for f in os.listdir(CACHE_DIR) if f.startswith("history_") and f.endswith(".json")]
    
    print(f"Checking {len(files)} cache files in {CACHE_DIR}...")
    
    for filename in files:
        filepath = os.path.join(CACHE_DIR, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            if not isinstance(data, list):
                print(f"[FAIL] {filename}: Not a list")
                continue
                
            dates = [m.get("date") for m in data if m.get("date")]
            if not dates:
                print(f"[WARN] {filename}: No dates found")
                continue
                
            dates.sort()
            min_date = dates[0]
            max_date = dates[-1]
            total_days = (datetime.strptime(max_date, "%Y-%m-%d") - datetime.strptime(min_date, "%Y-%m-%d")).days + 1
            unique_dates = sorted(list(set(dates)))
            unique_count = len(unique_dates)
            
            print(f"\nFile: {filename}")
            print(f"  Range: {min_date} to {max_date}")
            print(f"  Total Days Span: {total_days}")
            print(f"  Unique Dates Found: {unique_count}")
            print(f"  Coverage: {unique_count / total_days * 100:.1f}%")
            
            # Check for gaps > 2 days
            current = datetime.strptime(min_date, "%Y-%m-%d")
            end = datetime.strptime(max_date, "%Y-%m-%d")
            
            existing_dates = set(unique_dates)
            gaps = []
            
            while current <= end:
                d_str = current.strftime("%Y-%m-%d")
                if d_str not in existing_dates:
                    gaps.append(d_str)
                current += timedelta(days=1)
            
            if len(gaps) > 5:
                print(f"  [ALERT] Found {len(gaps)} missing days! First 5: {gaps[:5]}")
            elif len(gaps) > 0:
                print(f"  [WARN] Missing days: {gaps}")
            else:
                print("  [OK] No gaps found.")
                
        except Exception as e:
            print(f"[Err] {filename}: {str(e)}")

if __name__ == "__main__":
    check_cache_gaps()
