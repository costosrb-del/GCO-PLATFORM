
import sys
import os
import json
from collections import defaultdict
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.config import get_config
    from app.services.auth import get_auth_token
    from app.services.movements import get_consolidated_movements
    from app.services.utils import normalize_sku
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

def debug_live_analytics():
    print("--- LIVE ANALYTICS DEBUG (16 DAYS) ---")
    
    companies = get_config()
    target_company = None
    for c in companies:
        if "ARMONIA" in c["name"]:
            target_company = c
            break
            
    if not target_company:
        print("ARMONIA not found.")
        return

    company = target_company
    print(f"Analyzing {company['name']}...")
    token = get_auth_token(company["username"], company["access_key"])

    days = 16
    end_date = datetime.now() - timedelta(days=1)
    start_date = end_date - timedelta(days=days - 1)
    
    s_str = start_date.strftime("%Y-%m-%d")
    e_str = end_date.strftime("%Y-%m-%d")
    
    print(f"Range: {s_str} to {e_str}")
    
    # Selected Types
    sel_types = ["FV", "NC", "RM"]
    
    print(f"Fetching movements (FV, NC, RM)...")
    
    movements = get_consolidated_movements(token, s_str, e_str, selected_types=sel_types)
    
    print(f"Fetched {len(movements)} movements.")
    
    targets = ["7702", "3001", "3005"]
    
    totals = defaultdict(float)
    type_breakdown = defaultdict(lambda: defaultdict(float))
    
    for m in movements:
        code = normalize_sku(m.get("code"))
        if not code: continue
        
        # Check target match (loose)
        is_target = False
        for t in targets:
            if t in code:
                is_target = True
                real_target = t
                break
        
        if is_target:
            qty = float(m.get("quantity", 0))
            # NC is return -> Negative
            if m.get("doc_type") == "NC":
                qty = -qty
                
            totals[real_target] += qty
            type_breakdown[real_target][m.get("doc_type")] += qty
            
            print(f"  [HIT] {real_target} | {m.get('date')} | {m.get('doc_type')} {m.get('doc_number')} | Qty: {qty} | Code: {m.get('code')}")

    print("\n--- RESULTS ---")
    for t in targets:
        print(f"SKU {t}: Total = {totals[t]}")
        print(f"  Breakdown: {dict(type_breakdown[t])}")
        avg = totals[t] / days
        print(f"  Daily Avg: {avg:.4f}")

if __name__ == "__main__":
    debug_live_analytics()
