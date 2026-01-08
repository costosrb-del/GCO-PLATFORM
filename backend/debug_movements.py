
import os
import requests
import json
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_documents

# Temporary debug script to inspect raw answers for specific endpoints
def debug_endpoints():
    companies = get_config()
    target_company = next((c for c in companies if "RITUAL" in c["name"].upper()), None)
    
    if not target_company:
         print("RITUAL company not found, using first available.")
         target_company = companies[0]

    print(f"Testing with: {target_company['name']}")
    
    token = get_auth_token(target_company["username"], target_company["access_key"])
    if not token:
        print("Auth failed")
        return

    # User mentioned ND (Debit Note), RM (Delivery Note/Remision), NE (Journals/Ensamble)
    endpoints = ["journals"] # Focus on journals
    
    # Last 2 months
    start_date = "2024-11-01" 
    end_date = "2025-01-08"
    
    for ep in endpoints:
        print(f"\n--- Fetching {ep} ({start_date} to {end_date}) ---")
        param_name = "created_start" # Journals use created_start usually
        
        # Try filtering by Code 11 which is Nota de Ensamble
        url = "https://api.siigo.com/v1/journals"
        headers = {
            "Authorization": f"Bearer {token}",
            "Partner-Id": "GCOPlatformDebug"
        }
        params = {
            "created_start": start_date,
            "created_end": end_date,
            "page": 1,
            "page_size": 25,
            "name": "CC-11" 
        }
        
        print(f"Direct Request to {url} with params={params}")
        resp = requests.get(url, headers=headers, params=params)
        data = resp.json()
        # data = get_documents(...) # skipping wrapper for debug precision
        
        if data and "results" in data:
            results = data["results"]
            print(f"Found {len(results)} items.")
            if results:
                # If journals, check for "ensamble"
                if ep == "journals":
                    ensamble_count = 0
                    for r in results:
                        name = (r.get("name") or "").lower()
                        obs = (r.get("observations") or "").lower()
                        doc_type_name = (r.get("document", {}).get("name") or "").lower()
                        
                        if "ensamble" in name or "ensamble" in obs or "transformacion" in obs or "ensamble" in doc_type_name:
                            ensamble_count += 1
                            print("!!! Found Ensamble/Transformacion item !!!")
                            print(f"Name: {r.get('name')}, TypeName: {r.get('document', {}).get('name')}, Obs: {r.get('observations')}")
                    print(f"Total Ensambles in page: {ensamble_count}")
        else:
            print("No results returned.")

if __name__ == "__main__":
    debug_endpoints()
