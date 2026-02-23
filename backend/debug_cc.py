
import sys
import os
import requests
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.config import get_config
    from app.services.auth import get_auth_token
except ImportError:
    pass

def inspect_journals():
    print("--- INSPECTING JOURNALS (CC) ---")
    
    companies = get_config()
    target = next((c for c in companies if "ARMONIA" in c["name"]), None)
    if not target: return
    
    token = get_auth_token(target["username"], target["access_key"])
    url = "https://api.siigo.com/v1/journals"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}", "Partner-Id": "GCOPlatform"}
    
    params = {
        "page": 1, 
        "page_size": 5, 
        "created_start": "2026-02-01", 
        "created_end": "2026-02-17"
    }
    
    res = requests.get(url, headers=headers, params=params)
    data = res.json()
    results = data.get("results", [])
    print(f"Found {len(results)} Journals.")
    
    for j in results:
        print(f"\nJournal: {j.get('name')} | Date: {j.get('date')} | Obs: {j.get('observations')}")
        items = j.get("items", [])
        print(f"  Items ({len(items)}):")
        for i in items[:3]: # Show first 3
            prod = i.get("product", {})
            code = prod.get("code") if isinstance(prod, dict) else i.get("code")
            desc = i.get("description")
            qty = i.get("quantity")
            print(f"    - [{code}] {desc} | Qty: {qty}")

if __name__ == "__main__":
    inspect_journals()
