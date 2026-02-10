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

logging.basicConfig(level=logging.INFO)

def headers(token):
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": "GCOPlatform"
    }

def get_one_doc(token, endpoint):
    url = f"https://api.siigo.com/v1/{endpoint}"
    # Last 30 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    params = {
        "page": 1,
        "page_size": 1,
        "date_start": start_date.strftime("%Y-%m-%d"),
        "date_end": end_date.strftime("%Y-%m-%d")
    }
    
    try:
        resp = requests.get(url, headers=headers(token), params=params)
        resp = resp.json()
        if "results" in resp and resp["results"]:
            return resp["results"][0]
    except Exception as e:
        print(f"Error fetching {endpoint}: {e}")
    return None

def analyze_doc(doc, name):
    if not doc:
        print(f"\n{name}: Not found.")
        return

    print(f"\n--- ANALYSIS OF {name} ---")
    print("TOP LEVEL KEYS:")
    for key in doc:
        print(f" - {key}")

    # Specific fields of interest
    print("\nINTERESTING FIELDS:")
    for field in ["cost_center", "seller", "payment_forms", "taxes", "metadata", "currency", "observations"]:
        val = doc.get(field, "MISSING")
        print(f" {field}: {val}")

    # Item structure
    if "items" in doc and doc["items"]:
        print(f"\nITEM 0 KEYS (Total items: {len(doc['items'])}):")
        item0 = doc["items"][0]
        for k in item0:
            print(f" - {k}")
            
        print("\nITEM 0 VALUES:")
        print(json.dumps(item0, indent=2))

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

    analyze_doc(get_one_doc(token, "invoices"), "INVOICE (FV)")
    analyze_doc(get_one_doc(token, "purchases"), "PURCHASE (FC)")

if __name__ == "__main__":
    main()
