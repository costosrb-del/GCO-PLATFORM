
import sys
import os
import json
import requests
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.config import get_config
    from app.services.auth import get_auth_token
    from app.services.utils import normalize_sku
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def debug_direct_average():
    # SETTINGS
    TARGET_SKU = "7702" 
    DAYS = 16
    COMPANY_KEY = "ARMONIA" # Match from screenshot
    
    print(f"--- DEBUGGING DIRECT AVERAGE FOR {TARGET_SKU} ({DAYS} DAYS) ---")
    
    companies = get_config()
    target_company = next((c for c in companies if COMPANY_KEY in c["name"].upper()), None)
    
    if not target_company:
        print(f"Company {COMPANY_KEY} not found.")
        return

    token = get_auth_token(target_company["username"], target_company["access_key"])
    
    end_date = datetime.now() - timedelta(days=1) # Yesterday
    start_date = end_date - timedelta(days=DAYS - 1)
    
    s_str = start_date.strftime("%Y-%m-%d")
    e_str = end_date.strftime("%Y-%m-%d")
    
    print(f"Period: {s_str} to {e_str} ({DAYS} days)")
    
    # FETCH INVOICES
    url = "https://api.siigo.com/v1/invoices"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": "GCOPlatform"
    }
    
    all_invoices = []
    page = 1
    total_qty = 0
    
    while True:
        params = {
            "page": page,
            "page_size": 100,
            "date_start": s_str,
            "date_end": e_str
        }
        print(f"Fetching page {page}...")
        res = requests.get(url, headers=headers, params=params)
        if res.status_code != 200:
            print(f"Error: {res.text}")
            break
            
        data = res.json()
        results = data.get("results", [])
        if not results:
            break
            
        for inv in results:
            # Check items
            for item in inv.get("items", []):
                code = str(item.get("code", ""))
                # Normalization check
                norm_code = normalize_sku(code)
                
                # Also check product.code
                p_code = ""
                if isinstance(item.get("product"), dict):
                    p_code = item.get("product", {}).get("code", "")
                    
                if norm_code == TARGET_SKU or TARGET_SKU in code or TARGET_SKU in p_code:
                    qty = float(item.get("quantity", 0))
                    total_qty += qty
                    print(f"  [FOUND] {inv.get('name')} ({inv.get('date')}): +{qty} (Code: {code})")
                    all_invoices.append(inv)
        
        page += 1
        
    print(f"\n--- SUMMARY ---")
    print(f"Total Quantity Found: {total_qty}")
    print(f"Days: {DAYS}")
    
    calculated_avg = total_qty / DAYS
    print(f"Calculated Daily Average: {calculated_avg:.4f}")
    
    if calculated_avg == 0:
         print("WARNING: Average is 0. This explains the 'Infinite' or huge days supply.")

if __name__ == "__main__":
    debug_direct_average()
