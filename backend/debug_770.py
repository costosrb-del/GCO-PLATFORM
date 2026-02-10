import sys
import os
import json

# Add backend to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.inventory import get_all_products

def debug_770():
    companies = get_config()
    target_skus = ["770", "7701", "7702", "7703"]
    
    print(f"Searching for SKUs: {target_skus} or 'KERATINA' in name in {len(companies)} companies...")
    
    found_count = 0
    
    for company in companies:
        if not company.get("valid", True):
            print(f"Skipping invalid company: {company['name']}")
            continue
            
        print(f"\nScanning {company['name']}...")
        token = get_auth_token(company['username'], company['access_key'])
        
        if not token:
            print("  Failed to authenticate.")
            continue
            
        products = get_all_products(token)
        if not products:
            print("  No products returned.")
            continue
            
        print(f"  Fetched {len(products)} products total.")
        
        for p in products:
            code = str(p.get("code", "")).strip()
            name = str(p.get("name", "")).strip()
            
            # Check if any target is in code
            is_match_code = any(t in code for t in target_skus)
            is_match_name = "KERATINA" in name.upper()
            
            if is_match_code or is_match_name:
                found_count += 1
                print(f"  MATCH FOUND: Code='{code}', Name='{name}'")
                if "warehouses" in p:
                    for wh in p["warehouses"]:
                        w_name = wh.get("name", "Unknown")
                        w_qty = wh.get("quantity", 0)
                        print(f"    - Warehouse: '{w_name}', Qty: {w_qty}")
                else:
                    print("    - No specific warehouse data.")

    print(f"\nDone. Found {found_count} matching records.")

if __name__ == "__main__":
    debug_770()
