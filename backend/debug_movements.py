
import os
import requests
import json
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_documents

# Temporary debug script to inspect raw answers for specific endpoints
def debug_endpoints():
    companies = get_config()
    target_company = companies[0] # Test with first company (Armonia)
    
    print(f"Testing with: {target_company['name']}")
    
    token = get_auth_token(target_company["username"], target_company["access_key"])
    if not token:
        print("Auth failed")
        return

    # User mentioned ND (Debit Note), RM (Delivery Note/Remision), NE (Journals/Ensamble)
    endpoints = ["debit-notes", "delivery-notes", "journals"]
    
    # Last 2 months
    start_date = "2025-11-01" 
    end_date = "2026-01-08"
    
    for ep in endpoints:
        print(f"\n--- Fetching {ep} ({start_date} to {end_date}) ---")
        param_name = "created_start" if ep == "journals" else "date_start"
        
        data = get_documents(token, ep, start_date, end_date, page=1, page_size=20, date_param_name=param_name)
        
        if data and "results" in data:
            results = data["results"]
            print(f"Found {len(results)} items.")
            if results:
                print("First item sample:")
                first = results[0]
                print(json.dumps(first, indent=2))
                
                # If journals, check for "ensamble"
                if ep == "journals":
                    ensamble_count = 0
                    for r in results:
                        name = (r.get("name") or "").lower()
                        obs = (r.get("observations") or "").lower()
                        if "ensamble" in name or "ensamble" in obs or "transformacion" in obs:
                            ensamble_count += 1
                            print("!!! Found potential Ensamble/Transformacion item !!!")
                            print(f"Name: {r.get('name')}, Obs: {r.get('observations')}")
                    print(f"Total Ensambles in first page: {ensamble_count}")
        else:
            print("No results returned.")

if __name__ == "__main__":
    debug_endpoints()
