
import os
import sys
from dotenv import load_dotenv

# Load env vars
load_dotenv()

# Add app to path
sys.path.append(os.getcwd())

from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.inventory import get_all_products

def debug_hidden_stock():
    print("--- SCANNING FOR LARGE HIDDEN STOCK (> 500 units) ---")
    
    allowed = ["rionegro", "libre", "sin ingresar"]
    
    companies = get_config()
    for company in companies:
        if not company.get("valid", True):
            continue
            
        print(f"Scanning {company['name']}...")
        try:
            token = get_auth_token(company["username"], company["access_key"])
            if not token: continue
            
            products = get_all_products(token)
            if products:
                for p in products:
                    if "warehouses" in p:
                        for wh in p["warehouses"]:
                            w_name = str(wh.get("name", "")).lower()
                            qty = float(wh.get("quantity", 0))
                            
                            # Check if HIDDEN (not allowed) and LARGE
                            is_allowed = any(term in w_name for term in allowed)
                            
                            if not is_allowed and qty > 500:
                                print(f"  [HIDDEN STOCK FOUND]")
                                print(f"  Product: {p.get('code')} - {p.get('name')}")
                                print(f"  Warehouse: {wh.get('name')}")
                                print(f"  Quantity: {qty}")
                                print("-" * 30)
                                
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    debug_hidden_stock()
