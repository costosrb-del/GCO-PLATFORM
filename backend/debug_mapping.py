
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
    # Testing Ritual Botanico
    filename = "history_ARMONIA COSMETICA S.A.S..json"
    
    target_sku = "7702"
    start_date = "2026-02-01" 
    
    with open(os.path.join(cache_dir, filename), 'r', encoding='utf-8') as f:
        data = json.load(f)
        
        mapping = {} # original_code -> list of movements
        
        for m in data:
            norm = normalize_sku(m.get("code"))
            if norm == target_sku:
                if m.get("date") >= start_date and m.get("doc_type") in ["FV", "NC"]:
                    orig = m.get("code")
                    if orig not in mapping: mapping[orig] = []
                    mapping[orig].append(m)
        
    with open("mapping_debug_result_verbose.txt", "w", encoding="utf-8") as out:
        out.write(f"Detailed movements for {target_sku} in Ritual Botanico:\n")
        total_qty = 0
        hits = []
        for orig, movs in mapping.items():
            for m in movs:
                q = float(m.get("quantity", 0))
                val = -q if m.get("doc_type") == "NC" else q
                out.write(f"  {m['date']} {m['doc_type']} {m['doc_number']} : {q} -> {val} (Code: {orig})\n")
                total_qty += val
        
        out.write(f"\nTOTAL NET QTY: {total_qty}\n")
    print("Done. Check mapping_debug_result_verbose.txt")

if __name__ == "__main__":
    analyze()
