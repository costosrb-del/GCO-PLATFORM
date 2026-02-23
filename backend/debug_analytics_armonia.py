
import json
import os
from datetime import datetime, timedelta
from app.services.utils import normalize_sku

def calculate_debug():
    # Setup parameters as in analytics.py
    days = 16
    today = datetime.now()
    end_date = today - timedelta(days=1)
    # Using fixed dates for reproducibility (as in verify tests)
    start_str = "2026-01-31"
    end_str = "2026-02-15"
    selected_types = ["FV", "NC"]
    
    c_name = "ARMONIA COSMETICA S.A.S."
    path = rf"C:\tmp\gco_local_cache\history_{c_name}.json"
    
    if not os.path.exists(path):
        print("Cache not found")
        return

    with open(path, 'r', encoding='utf-8') as f:
        cached_data = json.load(f)
        
    print(f"Analyzing {c_name} from {start_str} to {end_str}")
    
    # Filter as in analytics.py (branch can_use_cache)
    movements = [
        m for m in cached_data 
        if m.get("doc_type") in selected_types 
        and start_str <= m.get("date") <= end_str
    ]
    
    print(f"Found {len(movements)} movements in range/type")
    
    # Aggregate as in analytics.py (loop over futures)
    split_totals = {}
    for mov in movements:
        m_date = mov.get("date", "")
        # Note: analytics.py filters AGAIN here
        if not (start_str <= m_date <= end_str):
            continue
            
        sku = normalize_sku(mov.get("code"))
        if not sku: continue
        
        q_val = float(mov.get("quantity", 0))
        is_return = mov.get("doc_type") == "NC"
        qty = -q_val if is_return else q_val
        
        if sku not in split_totals:
            split_totals[sku] = {"total": 0.0, "history": []}
            
        split_totals[sku]["total"] += qty
        split_totals[sku]["history"].append({"d": m_date, "q": qty, "orig": mov.get("code"), "doc": mov.get("doc_number")})

    if "7702" in split_totals:
        obj = split_totals["7702"]
        print(f"7702 Total: {obj['total']}")
        print("History:")
        for h in obj["history"]:
            print(f"  {h['d']} {h['doc']} {h['orig']} : {h['q']}")
    else:
        print("7702 NOT FOUND in split_totals")

calculate_debug()
