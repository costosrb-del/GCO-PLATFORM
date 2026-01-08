import requests
import os
import json
from app.services.config import get_config

# Load configuration (simulated for standalone script context if needed, or verified via direct import)
# Assuming run from root and backend module is accessible. 
# If not, we might need to sys.path.append('backend')
import sys
sys.path.append('backend')

def debug_document_types():
    # 1. Authenticate
    print("Authenticating...")
    import time

    import time

    companies = get_config()
    # Filter for RITUAL BOTANICO
    target_company = next((c for c in companies if "RITUAL" in c["name"].upper()), None)
    
    if not target_company:
        print("RITUAL BOTANICO not found, checking all.")
        target_list = companies
    else:
        target_list = [target_company]

    for config in target_list:
        print(f"\n--- Checking Company: {config['name']} ---")
        
        auth_url = "https://api.siigo.com/auth"
        auth_payload = {
            "username": config["username"],
            "access_key": config["access_key"]
        }
        
        try:
            auth_resp = requests.post(auth_url, json=auth_payload)
            auth_resp.raise_for_status()
            token = auth_resp.json()["access_token"]
        except Exception as e:
            print(f"Auth failed: {e}")
            continue

        headers = {
            "Authorization": f"Bearer {token}",
            "Partner-Id": "GCOPlatformDebug"
        }

        types_to_check = ['CC', 'NC', 'ND', 'FC', 'FV']
        
        for dtype in types_to_check:
            url = f"https://api.siigo.com/v1/document-types?type={dtype}"
            print(f" -- Fetching type={dtype} --")
            
            try:
                resp = requests.get(url, headers=headers)
                if resp.status_code >= 400:
                    print(f"Failed: {resp.status_code} - {resp.text}")
                    continue

                doc_types = resp.json()
                print(f"    Found {len(doc_types)} types.")
                
                for dt in doc_types:
                     print(f"    ID={dt.get('id')} Code={dt.get('code')} Name={dt.get('name')} Active={dt.get('active')}")
                    
            except Exception as e:
                print(f"Error: {e}")
            
            time.sleep(0.5)

if __name__ == "__main__":
    debug_document_types()
