import sys
import os
import requests
import json
import time

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.services.config import get_config
from app.services.auth import get_auth_token

PRODUCTS_URL = "https://api.siigo.com/v1/products"

def find_target_products():
    companies = get_config()
    target_skus = ["770", "7701", "7702", "7703", "EVO-7701", "EVO-7702", "EVO-7703"]
    
    results_found = []
    
    for company in companies:
        if not company.get("valid"):
            continue
            
        print(f"Scanning company: {company['name']}")
        token = get_auth_token(company['username'], company['access_key'])
        if not token:
            print(f"Auth failed for {company['name']}")
            continue
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "Partner-Id": "GCOPlatform"
        }
        
        page = 1
        while True:
            try:
                print(f" - Page {page}...", end='\r')
                resp = requests.get(PRODUCTS_URL, headers=headers, params={"page": page, "page_size": 100}, timeout=10)
                if resp.status_code != 200:
                    break
                    
                data = resp.json()
                items = data.get("results", [])
                if not items:
                    break
                    
                for p in items:
                    code = str(p.get("code", "")).strip()
                    name = str(p.get("name", "")).strip()
                    
                    is_match = any(t == code for t in target_skus) or "KERATINA" in name.upper()
                    
                    if is_match:
                        results_found.append({
                            "company": company['name'],
                            "id": p.get("id"),
                            "code": code,
                            "name": name,
                            "warehouses": p.get("warehouses", [])
                        })
                
                pagination = data.get("pagination", {})
                total_results = pagination.get("total_results", 0)
                if page * 100 >= total_results:
                    break
                page += 1
                if page > 100: break # Safety
                
            except Exception as e:
                print(f"Error: {e}")
                break
                
    return results_found

if __name__ == "__main__":
    found = find_target_products()
    with open("backend/found_770_debug.json", "w") as f:
        json.dump(found, f, indent=2)
    print(f"\nDone. Found {len(found)} entries.")
