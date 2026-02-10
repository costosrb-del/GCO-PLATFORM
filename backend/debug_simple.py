import sys
import os
import requests
import json
import time

# Add backend to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.services.config import get_config
from app.services.auth import get_auth_token

PRODUCTS_URL = "https://api.siigo.com/v1/products"

def debug_simple():
    companies = get_config()
    target_skus = ["770", "7701", "7702", "7703"]
    
    # Only check the first valid company
    company = next((c for c in companies if c.get("valid")), None)
    if not company:
        print("No valid companies found.")
        return

    print(f"Checking company: {company['name']}")
    token = get_auth_token(company['username'], company['access_key'])
    if not token:
        print("Auth failed.")
        return

    print("Fetching products...")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": "SiigoApi"
    }

    page = 1
    found_any = False
    
    while True:
        try:
            print(f"Fetching page {page}...", end='\r')
            resp = requests.get(PRODUCTS_URL, headers=headers, params={"page": page, "page_size": 100}, timeout=10)
            if resp.status_code != 200:
                print(f"Error: {resp.status_code}")
                break
                
            data = resp.json()
            if not data or "results" not in data:
                print("No results.")
                break
                
            results = data["results"]
            if not results:
                break
                
            for p in results:
                code = str(p.get("code", "")).strip()
                name = str(p.get("name", "")).strip()
                
                is_match = any(t in code for t in target_skus) or "KERATINA" in name.upper()
                
                if is_match:
                    found_any = True
                    print(f"\nMATCH FOUND: Code='{code}', Name='{name}'")
                    if "warehouses" in p:
                        for wh in p["warehouses"]:
                            w_name = wh.get("name", "Unknown")
                            w_qty = wh.get("quantity", 0)
                            print(f"  - Warehouse: '{w_name}', Qty: {w_qty}")
                    else:
                        print("  - No warehouse data.")

            pagination = data.get("pagination", {})
            total_pages = 0
            if "total_results" in pagination:
                 import math
                 total_pages = math.ceil(pagination["total_results"] / 100)
            
            if page >= total_pages or not results:
                break
                
            page += 1
            if found_any and page > 5: # Limit search if we found something
                 # Continue searching a bit more in case later pages have more
                 if page > 20: break 
            elif page > 50: # Safety stop
                 break
                 
        except Exception as e:
            print(f"Error: {e}")
            break

    print("\nScan complete.")

if __name__ == "__main__":
    debug_simple()
