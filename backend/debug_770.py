import sys
import os
import re
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Add current directory to path so 'app' module can be found
sys.path.append(os.getcwd())

from app.services.inventory import get_all_products
from app.services.auth import get_auth_token
from app.services.config import get_config
from app.services.utils import normalize_sku

def main():
    print("Debug: Checking for 770 codes...")
    
    companies = get_config()
    target_company = None
    # Just find one company to test, preferably one that likely has these
    # Assuming 'GCO' or similar might have it, or iterate all
    
    for c in companies:
        if c.get("valid", False):
            print(f"Checking company: {c['name']}")
            try:
                token = get_auth_token(c["username"], c["access_key"])
                if not token:
                    print("  Failed to get token")
                    continue
                
                # We can filter parameters in get_products, but get_all_products usually fetches ALL.
                # However, for debugging strict "770" issues, we want to see RAW codes.
                
                # Fetch only page 1 first to be quick
                from app.services.inventory import get_products
                data = get_products(token, page=1, page_size=100)
                
                if not data:
                    print("  No data returned")
                    continue
                    
                total = data.get("pagination", {}).get("total_results", 0)
                print(f"  Total products: {total}")
                
                # Now fetch ALL if specific code not found in first page?
                # Actually, let's just search the first 100 first.
                
                found_770 = False
                
                for p in data.get("results", []):
                    code = p.get("code", "")
                    name = p.get("name", "")
                    
                    if "770" in code or "770" in name:
                        norm = normalize_sku(code)
                        print(f"  MATCH FOUND: Code='{code}' Name='{name}' -> Norm='{norm}'")
                        found_770 = True
                        
                if not found_770:
                    print("  No '770' matches in first 100 products. Checking further pages is expensive but can be done if needed.")
                    
            except Exception as e:
                print(f"  Error: {e}")

if __name__ == "__main__":
    main()
