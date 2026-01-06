import sys
import os
import json
from datetime import datetime, timedelta

# Add current directory to path
sys.path.append(os.getcwd())

from app.services.analytics import calculate_average_sales
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_consolidated_movements

def verify_math():
    print("--- VERIFICATION: Sales Averages (7 Days) ---")
    
    # 1. Run the System Logic
    print("Running system calculation (calculate_average_sales)...")
    system_averages, audit = calculate_average_sales(days=7)
    
    # 2. Pick a top mover to audit
    # Sort by average desc
    sorted_skus = sorted(system_averages.items(), key=lambda x: x[1], reverse=True)
    if not sorted_skus:
        print("No sales found in the last 7 days.")
        return

    # Pick top 1
    target_sku, system_avg = sorted_skus[0]
    print(f"\nAUDITING SKU: {target_sku}")
    print(f"System says Average is: {system_avg} units/day")
    
    # 3. Manual Re-Calculation (The "Hard Way")
    print("\nPerforming Manual Re-Calculation from Raw Data...")
    
    # Re-construct exact same date window locally to be sure
    today = datetime.now()
    end_date = today - timedelta(days=1)
    start_date = end_date - timedelta(days=7 - 1) # Same fix we applied
    
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    print(f"Window: {start_str} to {end_str} (7 Days)")
    
    companies = get_config()
    total_qty_manual = 0
    
    for c in companies:
        if not c.get("valid", True): continue
        
        token = get_auth_token(c["username"], c["access_key"])
        if not token: continue
        
        # Fetch ONLY this SKU if possible? No, API doesn't filter by SKU server side well.
        # Fetch FV for this window
        print(f"  Checking {c['name']}...")
        movs = get_consolidated_movements(token, start_str, end_str, selected_types=["FV"])
        
        # Filter for our SKU
        sku_movs = [m for m in movs if m.get("code") == target_sku]
        
        c_qty = sum(abs(m['quantity']) for m in sku_movs)
        print(f"    -> Found {len(sku_movs)} invoices. Sum Qty: {c_qty}")
        total_qty_manual += c_qty
        
    manual_avg = total_qty_manual / 7
    manual_avg = round(manual_avg, 4)
    
    print(f"\n--- COMPARISON ---")
    print(f"SKU: {target_sku}")
    print(f"Manual Sum (7 Days): {total_qty_manual}")
    print(f"Manual Average:      {manual_avg}")
    print(f"System Average:      {system_avg}")
    
    if abs(manual_avg - system_avg) < 0.001:
        print("\n✅ MATCH! The system calculation is mathematically correct.")
    else:
        print(f"\n❌ MISMATCH! Diff: {abs(manual_avg - system_avg)}")

if __name__ == "__main__":
    verify_math()
