
import os
import json
from datetime import datetime, timedelta
from app.services.config import get_config
from app.services.utils import normalize_sku
from app.services.cache import cache

# Force local mode for debugging
os.environ["CACHE_MODE"] = "local" 
os.environ["LOCAL_CACHE_DIR"] = r"C:\tmp\gco_local_cache"

def debug_calculation(company_name, sku_target, days=30):
    print(f"\n--- DEBUGGING AVERAGES FOR {company_name} (SKU: {sku_target}) ---")
    
    # Calculate Window
    today = datetime.now()
    end_date = today - timedelta(days=1)
    start_date = end_date - timedelta(days=days - 1)
    
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    print(f"Window: {start_str} to {end_str} ({days} days)")
    
    # Load Cache
    cache_key = f"history_{company_name}.json"
    data = cache.load(cache_key)
    
    if not data:
        print("Cache not found or empty.")
        return

    print(f"Total records in cache: {len(data)}")
    
    # Filter
    movements_in_range = []
    total_qty = 0.0
    
    for m in data:
        d = m.get("date")
        if start_str <= d <= end_str:
            code = normalize_sku(m.get("code"))
            if code == sku_target:
                qty = float(m.get("quantity", 0))
                doc_type = m.get("doc_type")
                
                # Logic from analytics.py
                # selected_types = ["FV", "NC"]
                # However, analytics.py fetches specific types. The cache might have mixed types.
                # calculate_average_sales FILTERS internally for FV and NC.
                
                if doc_type == "FV":
                    val = qty
                elif doc_type == "NC":
                    val = -qty # Return
                else:
                    # print(f"  Skipping doc_type: {doc_type}")
                    continue
                
                total_qty += val
                movements_in_range.append(f"{d} | {doc_type} | {m.get('doc_number')} | Qty: {qty} -> {val}")

    print(f"\nMovements Found ({len(movements_in_range)}):")
    for log in sorted(movements_in_range):
        print("  " + log)
        
    print(f"\nTotal Net Qty: {total_qty}")
    print(f"Divisor (Days): {days}")
    
    average = total_qty / days
    print(f"CALCULATED DAILY AVERAGE: {average:.4f}")
    print(f"PROJECTED MONTHLY (x30): {average * 30:.4f}")

if __name__ == "__main__":
    # Test with one company that had issues
    debug_calculation("ARMONIA COSMETICA S.A.S.", "7702", days=16)
    debug_calculation("ARMONIA COSMETICA S.A.S.", "7702", days=30)
