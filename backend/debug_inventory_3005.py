
import os
import sys
import json
from dotenv import load_dotenv

# Load env vars
load_dotenv()

# Add app to path
sys.path.append(os.getcwd())

from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.inventory import get_all_products
from app.services.utils import fetch_google_sheet_inventory

def debug_3005():
    print("--- DEBUGGING PRODUCT 3005 ---")
    
    # 1. Check External (Google Sheets)
    sheet_url = os.getenv("GSHEET_INVENTORY_URL") or os.getenv("GOOGLE_SHEET_URL")
    if sheet_url:
        print("\n[EXTERNAL INVENTORY]")
        try:
            data = fetch_google_sheet_inventory(sheet_url)
            found = False
            for item in data:
                if "3005" in str(item.get("code")):
                    print(f"FOUND IN EXTERNAL: {item}")
                    found = True
            if not found:
                print("Not found in External Inventory.")
        except Exception as e:
            print(f"Error checking external: {e}")
    
    # 2. Check Siigo
    companies = get_config()
    for company in companies:
        if not company.get("valid", True):
            continue
            
        print(f"\n[COMPANY: {company['name']}]")
        try:
            token = get_auth_token(company["username"], company["access_key"])
            if not token:
                print("  Auth Failed.")
                continue
                
            # Fetch all products (Siigo API doesn't support filtering by code easily in the generic endpoint we use, 
            # or maybe it does but get_all_products fetches all). 
            # We'll use get_all_products for consistency with the app logic.
            products = get_all_products(token)
            
            found = False
            if products:
                for p in products:
                    if "3005" in str(p.get("code")):
                        found = True
                        print(f"  > Code: {p.get('code')}")
                        print(f"  > Name: {p.get('name')}")
                        
                        # Print Warehouses
                        if "warehouses" in p:
                            for wh in p["warehouses"]:
                                w_name = wh.get("name", "Unknown")
                                w_qty = wh.get("quantity", 0)
                                print(f"    - Warehouse: '{w_name}' | Qty: {w_qty}")
                        else:
                            print("    - No warehouse detail found.")
                            
            if not found:
                print("  Product 3005 NOT FOUND in this company.")
                
        except Exception as e:
            print(f"  Error: {e}")

if __name__ == "__main__":
    debug_3005()
