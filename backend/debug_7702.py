
import json
import re
import os
from datetime import datetime, timedelta

def normalize_sku(code):
    if not code: return "N/A"
    code = str(code).strip().upper()
    if "INSUMO" in code: return code
    code = code.replace("EVO-", "").replace("EVO", "").replace("E-", "")
    suffixes = ["EXENTO", "EX", ".1", "-1"]
    for s in suffixes:
        if code.endswith(s):
             code = code[:-len(s)]
             break
    match_long = re.search(r"(\d{4,})", code)
    if match_long: return match_long.group(1)
    match_any = re.search(r"(\d+)", code)
    if match_any: return match_any.group(1)
    return code

def analyze_7702():
    cache_dir = r"C:\tmp\gco_local_cache"
    files = [f for f in os.listdir(cache_dir) if f.startswith("history_") and f.endswith(".json")]
    
    target_sku = "7702"
    # Adjust date for current local Feb 16th context
    start_date = "2026-02-01" 
    
    print(f"Analyzing {target_sku} movements since {start_date}")
    
    all_hits = []
    
    for filename in files:
        with open(os.path.join(cache_dir, filename), 'r', encoding='utf-8') as f:
            data = json.load(f)
            if not isinstance(data, list): continue
            
            for m in data:
                if normalize_sku(m.get("code")) == target_sku:
                    if m.get("date") >= start_date and m.get("doc_type") in ["FV", "NC"]:
                        m['_source'] = filename
                        all_hits.append(m)
    
    print(f"Found {len(all_hits)} movements for {target_sku}")
    
    company_totals = {}
    for h in all_hits:
        c = h['_source']
        if c not in company_totals: company_totals[c] = 0
        doc_type = h.get("doc_type")
        raw_qty = float(h.get("quantity", 0))
        qty = -raw_qty if doc_type == "NC" else raw_qty
        company_totals[c] += qty
    
    for c, total in company_totals.items():
        print(f"Company {c}: {total} (Avg: {total/16})")

    target_comp = "history_RITUAL BOTANICO S.A.S..json"
    hits = [h for h in all_hits if h['_source'] == target_comp]
    hits.sort(key=lambda x: float(x.get("quantity", 0)), reverse=True)
    
    print(f"\nTop 20 Movements for {target_comp}:")
    for h in hits[:20]:
        print(f"  {h['date']} {h['doc_type']} {h['doc_number']}: {h.get('quantity')} - {h.get('client')}")

if __name__ == "__main__":
    analyze_7702()
