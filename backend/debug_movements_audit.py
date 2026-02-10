import sys
import os
import requests
import json
import logging
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__)))

from app.services.config import get_config
from app.services.auth import get_auth_token

# Setup logging
logging.basicConfig(level=logging.INFO)

def headers(token):
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": "GCOPlatform"
    }

def get_one_doc(token, endpoint):
    url = f"https://api.siigo.com/v1/{endpoint}"
    # Fetch last 30 days to find at least one
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    params = {
        "page": 1,
        "page_size": 1,
        "date_start": start_date.strftime("%Y-%m-%d"),
        "date_end": end_date.strftime("%Y-%m-%d")
    }
    
    print(f"Fetching 1 {endpoint}...")
    try:
        resp = requests.get(url, headers=headers(token), params=params)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if results:
            return results[0]
        else:
            print(f"No {endpoint} found in last 30 days.")
            return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def main():
    companies = get_config()
    company = next((c for c in companies if c.get("valid")), None)
    
    if not company:
        print("No valid company found.")
        return

    print(f"Using Company: {company['name']}")
    token = get_auth_token(company['username'], company['access_key'])
    
    if not token:
        print("Auth failed.")
        return

    # 1. Fetch Invoice (FV)
    fv = get_one_doc(token, "invoices")
    if fv:
        print("\n--- RAW INVOICE (FV) ---")
        print(json.dumps(fv, indent=2))
        
    # 2. Fetch Purchase (FC)
    fc = get_one_doc(token, "purchases")
    if fc:
        print("\n--- RAW PURCHASE (FC) ---")
        print(json.dumps(fc, indent=2))

if __name__ == "__main__":
    main()
