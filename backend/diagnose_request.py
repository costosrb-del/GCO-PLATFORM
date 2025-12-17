import sys
import os
import json
import requests
from datetime import datetime

# Add current directory to path
sys.path.append(os.getcwd())

from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_all_documents, extract_movements_from_doc

def diagnose():
    print("--- DIAGNOSTIC RUN: Ritual Botanico (Jan 2024) ---")
    
    # 1. Auth
    companies = get_config()
    target = next((c for c in companies if "RITUAL" in c['name'].upper()), None)
    
    if not target:
        print("CRITICAL: Ritual Botanico not found in config!")
        # Fallback to first valid
        target = next((c for c in companies if c.get('valid', True)), None)
        print(f"Falling back to: {target['name']}")
        
    token = get_auth_token(target['username'], target['access_key'])
    print(f"Auth Token: {token[:10]}... (Length: {len(token)})")
    
    # 2. Test Filters
    start_date = "2024-01-01"
    end_date = "2024-01-31" # API uses exclusive end? We use +1 day in service normally.
    
    # Simulate Service Logic
    from datetime import timedelta
    api_end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
    api_end_str = api_end_dt.strftime("%Y-%m-%d")
    
    print(f"Querying Siigo API: {start_date} to {api_end_str}")
    
    # 3. Fetch Invoices (FV)
    endpoint = "invoices"
    print(f"\n--- Fetching {endpoint} ---")
    
    docs = get_all_documents(token, endpoint, start_date, api_end_str)
    print(f"Raw Documents Fetched: {len(docs)}")
    
    if len(docs) == 0:
        print("CRITICAL: Siigo returned 0 documents.")
        return

    # 4. Analyze First Document
    print("\n--- Analysing Sample Document ---")
    sample_doc = docs[0]
    print(json.dumps(sample_doc, indent=2))
    
    # 5. Test Extraction
    print("\n--- Testing Extraction Logic ---")
    movements = extract_movements_from_doc(sample_doc, endpoint)
    print(f"Extracted {len(movements)} movements from sample doc.")
    
    if len(movements) == 0:
        print("CRITICAL: Extraction returned 0 items. Checking why...")
        items = sample_doc.get("items", [])
        for i, item in enumerate(items):
            print(f"  Item {i}: Code={item.get('code')} Qty={item.get('quantity')}")
            
    # 6. Full Extraction Stats
    total_movs = 0
    for doc in docs:
        movs = extract_movements_from_doc(doc, endpoint)
        total_movs += len(movs)
        
    print(f"\nTotal Movements Extracted from {len(docs)} documents: {total_movs}")

if __name__ == "__main__":
    diagnose()
