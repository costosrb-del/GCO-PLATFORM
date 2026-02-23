
import sys
import os
import requests
import json
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.config import get_config
    from app.services.auth import get_auth_token
except ImportError:
    pass

def brute_force_rm():
    print("--- BRUTE FORCE RM FETCH ---")
    
    companies = get_config()
    target = next((c for c in companies if "ARMONIA" in c["name"]), None)
    if not target: return
    
    token = get_auth_token(target["username"], target["access_key"])
    url = "https://api.siigo.com/v1/delivery-notes"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}", "Partner-Id": "GCOPlatform"}
    
    # 1. Try date_start
    print("\nAttempt 1: date_start")
    p1 = {"page": 1, "page_size": 25, "date_start": "2026-02-01", "date_end": "2026-02-17"}
    res = requests.get(url, headers=headers, params=p1)
    print(f"Status: {res.status_code}")
    if res.status_code != 200: print(f"Err: {res.text}")
    
    # 2. Try created_start
    print("\nAttempt 2: created_start")
    p2 = {"page": 1, "page_size": 25, "created_start": "2026-02-01", "created_end": "2026-02-17"}
    res = requests.get(url, headers=headers, params=p2)
    print(f"Status: {res.status_code}")
    if res.status_code != 200: print(f"Err: {res.text}")
    
    # 3. Try NO DATE (Just page)
    print("\nAttempt 3: No Date")
    p3 = {"page": 1, "page_size": 1}
    res = requests.get(url, headers=headers, params=p3)
    print(f"Status: {res.status_code}")
    if res.status_code != 200: print(f"Err: {res.text}")

if __name__ == "__main__":
    brute_force_rm()
