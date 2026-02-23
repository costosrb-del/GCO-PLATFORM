
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

def test_fetch():
    print("--- TESTING RM FETCH ---")
    
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
    
    url = "https://api.siigo.com/v1/delivery-notes"
    
    # EXACT PARAMS AS movements.py
    params = {
        "page": 1,
        "page_size": 25,
        "date_start": "2026-02-01",
        "date_end": "2026-02-17" 
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": "GCOPlatform"
    }
    
    print(f"URL: {url}")
    print(f"Params: {params}")
    
    try:
        res = requests.get(url, headers=headers, params=params, timeout=30)
        print(f"Status Code: {res.status_code}")
        
        if res.status_code != 200:
            print(f"Response Text: {res.text}")
        else:
            data = res.json()
            results = data.get("results", [])
            print(f"Success! Found {len(results)} items.")
            if results:
                print("First item sample:")
                print(json.dumps(results[0], indent=2)[:500])
                
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_fetch()
