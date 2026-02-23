
import sys
import os
import time
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.config import get_config
    from app.services.analytics import calculate_average_sales
    from app.services.cache import cache
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def debug_distribution_averages():
    print("--- DEBUG DISTRIBUTION AVERAGES ---")
    
    # 1. Clear specific cache to force recalc
    # We are debugging 'split_by_company' calculation
    # distribution_router uses `sales_averages_split_30d.json` (or whatever days passed)
    # Default is 30 days.
    
    avg_days = 30
    cache_key = f"sales_averages_split_{avg_days}d.json"
    print(f"Clearing cache: {cache_key}")
    cache.save(cache_key, None) # Clear it
    
    print(f"Running calculate_average_sales(days={avg_days}, split_by_company=True)...")
    
    try:
        start_t = time.time()
        result_tuple = calculate_average_sales(days=avg_days, split_by_company=True)
        elapsed = time.time() - start_t
        
        split_averages = result_tuple[0]
        audit = result_tuple[2]
        
        print(f"\nCalculation took {elapsed:.2f}s")
        print("\n--- RESULTS BY COMPANY ---")
        
        companies = get_config()
        for c in companies:
            c_name = c["name"]
            c_data = split_averages.get(c_name, {})
            sku_count = len(c_data)
            total_matches = audit["companies"].get(c_name, "N/A")
            
            print(f"\nCompany: {c_name}")
            print(f"  Movements Fetched: {total_matches}")
            print(f"  SKUs with Average > 0: {sku_count}")
            
            if sku_count == 0:
                print("  !!! ZERO AVERAGES !!!")
                # Diagnosis suggestions
                if total_matches == 0:
                     print("    -> No movements found from API. Check Auth/Permissions/Date Range.")
                else:
                     print("    -> Movements found but filtered out? Check SKU Normalization.")
            else:
                # Show top 3 SKUs
                top_skus = sorted(c_data.items(), key=lambda x: x[1], reverse=True)[:3]
                print(f"  Top SKUs: {top_skus}")
                
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_distribution_averages()
