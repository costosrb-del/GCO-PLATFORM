
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
    filename = "history_RITUAL BOTANICO S.A.S..json"
    
    start_date = "2026-02-01" 
    
    with open(os.path.join(cache_dir, filename), 'r', encoding='utf-8') as f:
        data = json.load(f)
        
        for sku in ["7701", "7702"]:
            count = 0
            qty = 0
            for m in data:
                if normalize_sku(m.get("code")) == sku:
                    if m.get("date") >= start_date and m.get("doc_type") in ["FV", "NC"]:
                        count += 1
                        q = float(m.get("quantity", 0))
                        qty += -q if m.get("doc_type") == "NC" else q
            print(f"SKU {sku}: {count} movements, Total Qty: {qty}")

if __name__ == "__main__":
    analyze()
