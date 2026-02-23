
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

def brute_force_url():
    print("--- BRUTE FORCE RM URL ---")
    
    companies = get_config()
    target = next((c for c in companies if "ARMONIA" in c["name"]), None)
    if not target: return
    
    token = get_auth_token(target["username"], target["access_key"])
    base = "https://api.siigo.com/v1"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}", "Partner-Id": "GCOPlatform"}
   
    candidates = [
        "delivery-notes",
        "delivery_notes",
        "remisiones",
        "documents?type=RM",
        "documents?type=delivery-note"
    ]

    for c in candidates:
        url = f"{base}/{c}"
        print(f"\nTrying: {url}")
        try:
            res = requests.get(url, headers=headers, params={"page": 1, "page_size": 1})
            print(f"Status: {res.status_code}")
            if res.status_code == 200:
                print("SUCCESS!")
                print(res.text[:200])
                break
            else:
                print(f"Err: {res.text[:100]}")
        except Exception as e:
            print(f"Ex: {e}")

if __name__ == "__main__":
    brute_force_url()
