
import sys
import os
import json
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.analytics import calculate_average_sales
    from app.services.cache import cache
    from app.services.config import get_config
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def debug_combos():
    print("--- DEBUGGING COMBO SKUS (3001, 3005) ---")
    
    # 1. Inspect Cache for recent movements of 3001
    companies = get_config()
    target_skus = ["3001", "3005", "7008"] # 7008 as control (it works per screenshot)
    
    print(f"Checking local cache for {len(companies)} companies...")
    
    today = datetime.now()
    start_date = today - timedelta(days=17) # 16 days ago + margin
    start_str = start_date.strftime("%Y-%m-%d")
    
    found_count = {sku: 0 for sku in target_skus}
    
    for c in companies:
        c_name = c["name"]
        hist_key = f"history_{c_name}.json"
        
        data = cache.load(hist_key)
        if not data:
            print(f"  {c_name}: No cache found.")
            continue
            
        print(f"  {c_name}: Cache has {len(data)} records.")
        
        # Check last date in cache
        if data:
            last_date = data[-1].get("date")
            print(f"    Last cached date: {last_date}")
            
        # Count target SKUs in recent range
        c_counts = {sku: 0 for sku in target_skus}
        
        for m in data:
            if m.get("date") >= start_str and m.get("doc_type") in ["FV", "NC"]:
                code = str(m.get("code", ""))
                # Simple loose match
                for sku in target_skus:
                    if sku in code:
                        c_counts[sku] += 1
                        # Print sample
                        if c_counts[sku] <= 1:
                            print(f"    [SAMPLE] Found {sku} in {c_name}: {m['date']} ({m['doc_type']}) Qty: {m['quantity']}")
                            
        for sku in target_skus:
            found_count[sku] += c_counts[sku]
            if c_counts[sku] > 0:
                print(f"    -> Found {c_counts[sku]} movements for {sku}")

    print("\n--- RUNNING ANALYTICS CALCULATION (16 days) ---")
    try:
        # Run the actual function
        avgs, trends, audit = calculate_average_sales(days=16, split_by_company=True)
        
        print("\n--- RESULTS ---")
        # Aggregated Check
        global_avgs = {}
        for c_name, data in avgs.items():
            for sku, val in data.items():
                global_avgs[sku] = global_avgs.get(sku, 0) + val
                
        for sku in target_skus:
            print(f"SKU {sku}: Global Avg = {global_avgs.get(sku, 0)}")
            
            # Detailed breakdown
            for c_name, data in avgs.items():
                if sku in data and data[sku] > 0:
                    print(f"  - {c_name}: {data[sku]}")

    except Exception as e:
        print(f"Analytics Error: {e}")

if __name__ == "__main__":
    debug_combos()
