
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

def analyze():
    cache_dir = r"C:\tmp\gco_local_cache"
    filename = "history_HECHIZO DE BELLEZA S.A.S..json"
    
    target_sku = "7702"
    start_date = "2026-02-01" 
    
    with open(os.path.join(cache_dir, filename), 'r', encoding='utf-8') as f:
        data = json.load(f)
        hits = []
        for m in data:
            if normalize_sku(m.get("code")) == target_sku:
                if m.get("date") >= start_date and m.get("doc_type") in ["FV", "NC"]:
                    hits.append(m)
        
        hits.sort(key=lambda x: float(x.get("quantity", 0)), reverse=True)
        print(f"Total hits: {len(hits)}")
        for h in hits[:10]:
            print(f"  {h['date']} {h['doc_type']} {h['doc_number']}: {h.get('quantity')} - {h.get('client')}")

if __name__ == "__main__":
    analyze()
