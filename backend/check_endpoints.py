
import sys
import os
import requests
import json
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.config import get_config
    from app.services.auth import get_auth_token
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def check_all_endpoints():
    print("--- CHECKING ALL ENDPOINTS FOR ACTIVITY ---")
    
    companies = get_config()
    target_company = None
    for c in companies:
        if "ARMONIA" in c["name"]:
            target_company = c
            break
            
    if not target_company:
        print("ARMONIA not found.")
        return

    print(f"Using {target_company['name']}")
    token = get_auth_token(target_company["username"], target_company["access_key"])
    
    # Range
    s = "2026-02-01"
    e = "2026-02-17"
    
    endpoints = {
        "FV (Invoices)": "https://api.siigo.com/v1/invoices",
        "RM (Delivery Notes)": "https://api.siigo.com/v1/delivery-notes",
        "CC (Journals)": "https://api.siigo.com/v1/journals",
        "FC (Purchases)": "https://api.siigo.com/v1/purchases",
        "RC (Vouchers)": "https://api.siigo.com/v1/vouchers"
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": "GCOPlatform"
    }

    for name, url in endpoints.items():
        print(f"\nChecking {name}...")
        
        # Journals use 'created_start'
        date_key = "created_start" if "Journals" in name else "date_start"
        end_key = "created_end" if "Journals" in name else "date_end"
        
        params = {
            "page": 1,
            "page_size": 25,
            date_key: s,
            end_key: e
        }
        
        try:
            res = requests.get(url, headers=headers, params=params, timeout=15)
            print(f"  Status: {res.status_code}")
            
            if res.status_code == 200:
                data = res.json()
                results = data.get("results", [])
                total = data.get("pagination", {}).get("total_results", "?")
                print(f"  Found: {len(results)} items (Total: {total})")
                
                if results:
                    # Check first item structure
                    print(f"  Sample ID: {results[0].get('name') or results[0].get('id')}")
            else:
                print(f"  Error: {res.text[:100]}")
                
        except Exception as err:
            print(f"  Exception: {err}")

if __name__ == "__main__":
    check_all_endpoints()
