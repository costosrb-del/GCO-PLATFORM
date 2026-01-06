
import os
import sys
import json
from datetime import datetime
from dotenv import load_dotenv

# Load env from backend/.env
load_dotenv(dotenv_path="backend/.env")

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_consolidated_movements

def debug_mascarilla():
    # 1. Config
    companies = get_config()
    target_product_search = "MASCARILLA"
    days = 7
    
    today = datetime.now()
    end_date = today # Include today for debugging
    # start_date = end_date - timedelta(days=6) # 7 days inclusive
    
    # Use exact logic from analytics.py usually
    from datetime import timedelta
    end_date = today - timedelta(days=1)
    start_date = end_date - timedelta(days=days - 1)
    
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    print(f"--- Debugging '{target_product_search}' ---")
    print(f"Period: {start_str} to {end_str} ({days} days)")
    
    total_qty_fv = 0
    total_qty_all = 0
    
    # Iterate all companies
    for company in companies:
        if not company.get("valid", True):
             continue
             
        print(f"\nChecking Company: {company['name']}")
        token = get_auth_token(company["username"], company["access_key"])
        
        if not token:
            print("  Auth failed.")
            continue
            
        # Fetch ALL types for this period
        # types = None (fetch all)
        movements = get_consolidated_movements(token, start_str, end_str, selected_types=None)
        
        for m in movements:
            # Check if product matches
            p_name = m.get("name", "").upper()
            p_code = m.get("code", "").upper()
            
            if target_product_search in p_name or target_product_search.upper() in p_name:
                qty = abs(m.get("quantity", 0))
                doc_type = m.get("doc_type")
                
                print(f"  [{doc_type}] {m['date']} - {p_name} ({p_code}): {qty}")
                
                total_qty_all += qty
                if doc_type == "FV":
                    total_qty_fv += qty

    avg_fv = total_qty_fv / days
    avg_all = total_qty_all / days
    
    print("\n--- Summary ---")
    print(f"Total Qty (FV Only): {total_qty_fv:.2f} -> Avg: {avg_fv:.2f}/day")
    print(f"Total Qty (ALL Types): {total_qty_all:.2f} -> Avg: {avg_all:.2f}/day")
    
    # If Stock is 2900:
    stock = 2900
    days_fv = stock / avg_fv if avg_fv > 0 else 9999
    days_all = stock / avg_all if avg_all > 0 else 9999
    
    print(f"\nDays Supply (FV Only): {days_fv:.2f} days")
    print(f"Days Supply (ALL Types): {days_all:.2f} days")

if __name__ == "__main__":
    debug_mascarilla()
