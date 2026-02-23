
import sys
import os
import json
import requests
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.config import get_config
    from app.services.auth import get_auth_token
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def analyze_raw_invoices():
    print("--- DEEP DIVE: RAW INVOICE ITEMS FOR COMBO 3001 ---")
    
    companies = get_config()
    target_company = None
    # Prioritize companies likely to have this
    for c in companies:
        if "RITUAL" in c["name"] or "ARMONIA" in c["name"]:
            target_company = c
            # Break on Ritual explicitly if possible as it's the main one
            if "RITUAL" in c["name"]:
                break
            
    if not target_company:
        print("Could not find likely candidate company.")
        return

    print(f"Analyzing {target_company['name']}...")
    token = get_auth_token(target_company["username"], target_company["access_key"])
    if not token:
        print("Failed to get token")
        return

    # Fetch last 30 invoices (page 1)
    url = "https://api.siigo.com/v1/invoices"
    end_date = datetime.now()
    start_date = end_date - timedelta(days=10) # Last 10 days
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": "GCOPlatform"
    }

    params = {
        "page": 1,
        "page_size": 20,
        "date_start": start_date.strftime("%Y-%m-%d"),
        "date_end": end_date.strftime("%Y-%m-%d")
    }
    
    print(f"Fetching invoices from {params['date_start']}...")
    try:
        res = requests.get(url, headers=headers, params=params)
        res.raise_for_status()
        data = res.json()
        
        invoices = data.get("results", [])
        print(f"Found {len(invoices)} invoices.")
        
        match_found = False
        
        for inv in invoices:
            items = inv.get("items", [])
            for item in items:
                # Dump ANY item that looks like a combo or 3001
                desc = str(item.get("description", "")).upper()
                code = str(item.get("code", ""))
                
                # Check nested
                product_field = item.get("product", {})
                p_code = ""
                if isinstance(product_field, dict):
                    p_code = str(product_field.get("code", ""))
                
                # Loose match
                if "3001" in code or "3001" in p_code or "COMBO" in desc or "3005" in code or "KIT" in desc:
                    print(f"\n[MATCH FOUND] Invoice: {inv.get('name')} | Date: {inv.get('date')}")
                    print(f"Item Description: {desc}")
                    print("--- FULL ITEM JSON ---")
                    print(json.dumps(item, indent=2))
                    print("----------------------")
                    match_found = True
                    return # Stop after first match to avoid flooding
                    
        if not match_found:
            print("No matches for 3001/3005/COMBO/KIT found in the last 20 invoices.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_raw_invoices()
