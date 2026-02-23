
import json
import re
import os

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
    files = [f for f in os.listdir(cache_dir) if f.startswith("history_") and f.endswith(".json")]
    
    target_sku = "7702"
    start_date = "2026-02-01" 
    
    print(f"Global Audit for {target_sku} since {start_date}:")
    
    total_all = 0
    for filename in files:
        with open(os.path.join(cache_dir, filename), 'r', encoding='utf-8') as f:
            data = json.load(f)
            company_total = 0
            hits = []
            for m in data:
                if m.get("date", "") >= start_date:
                    if normalize_sku(m.get("code")) == target_sku and m.get("doc_type") in ["FV", "NC"]:
                        q = float(m.get("quantity", 0))
                        val = -q if m.get("doc_type") == "NC" else q
                        company_total += val
                        hits.append(m)
            
            if company_total != 0 or hits:
                print(f"  --- Company {filename}: {company_total} ({len(hits)} movs) ---")
                total_all += company_total
    
    print(f"GRAND TOTAL: {total_all}")

if __name__ == "__main__":
    analyze()
