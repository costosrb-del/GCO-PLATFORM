import sys
import os
import json
import requests
from datetime import datetime

# Add current directory to path so we can import app modules if needed
sys.path.append(os.getcwd())

from app.services.config import get_config
from app.services.auth import get_auth_token

def verify_history():
    print("--- SIIGO HISTORY VERIFICATION ---")
    
    # 1. Get Config
    companies = get_config()
    
    # 2. Iterate all valid companies
    for target in companies:
        if not target.get("valid", True): continue
        
        c_name = target['name']
        print(f"\nTesting Company: {c_name}")
        
        token = get_auth_token(target['username'], target['access_key'])
        if not token:
            print("Auth Failed.")
            continue
            
        start_date = "2024-01-01"
        end_date = "2024-01-31"
        
        # Test ALL Endpoints
        endpoints = [
            ("invoices", "date_start"),
            ("credit-notes", "date_start"),
            ("debit-notes", "date_start"),
            ("purchases", "date_start"),
            ("journals", "created_start"),
            ("delivery-notes", "date_start")
        ]
        
        for ep, date_param in endpoints:
            url = f"https://api.siigo.com/v1/{ep}"
            headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}", "Partner-Id": "SiigoApi"}
            params = {"page": 1, "page_size": 1, 
                      date_param: start_date, 
                      date_param.replace("start", "end"): end_date}
            
            try:
                res = requests.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    total = res.json().get("pagination", {}).get("total_results", 0)
                    print(f"  > {ep} (Jan 2024): {total} docs")
                else:
                    print(f"  > {ep} Error: {res.status_code}")
            except Exception as e:
                print(f"  > {ep} Exception: {e}")

if __name__ == "__main__":
    verify_history()
