
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
    print("--- RAW INVOICE ANALYSIS FOR COMBOS (3001, 3005) ---")
    
    companies = get_config()
    target_company = None
    # Prioritize ARMONIA or RITUAL as they likely sell Combos
    for c in companies:
        if "ARMONIA" in c["name"] or "RITUAL" in c["name"]:
            target_company = c
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
    start_date = end_date - timedelta(days=5)
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Partner-Id": "GCOPlatform"
    }

    params = {
        "page": 1,
        "page_size": 50,
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
        
        found_combo = False
        
        for inv in invoices:
            items = inv.get("items", [])
            has_combo = False
            
            # Check items for combo keywords
            for item in items:
                desc = str(item.get("description", "")).upper()
                code = str(item.get("code", ""))
                
                # Check nested product
                p_code = ""
                if "product" in item and isinstance(item["product"], dict):
                    p_code = str(item["product"].get("code", ""))
                
                if "3001" in code or "3001" in p_code or "COMBO" in desc or "3005" in code:
                    has_combo = True
                    print(f"\n[MATCH] Invoice {inv.get('name')} Date: {inv.get('date')}")
                    print(f"  Item Description: {desc}")
                    print(f"  Item Code (Direct): '{code}'")
                    print(f"  Item Product Code (Nested): '{p_code}'")
                    print(f"  Quantity: {item.get('quantity')}")
                    print(f"  Price: {item.get('price')}")
                    print(f"  Ref: {item}")
                    found_combo = True
            
            if has_combo and found_combo:
                # print full invoice structure for deep inspection
                # print(json.dumps(inv, indent=2))
                break # Just find one good example
                
        if not found_combo:
            print("No combos found in the last 50 invoices. Try extending date range manually.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_raw_invoices()
