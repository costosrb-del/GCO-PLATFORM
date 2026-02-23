
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
    
    mapping = {} # orig -> company
    
    for filename in files:
        with open(os.path.join(cache_dir, filename), 'r', encoding='utf-8') as f:
            data = json.load(f)
            for m in data:
                orig = m.get("code")
                norm = normalize_sku(orig)
                if norm == target_sku:
                    if orig not in mapping: mapping[orig] = set()
                    mapping[orig].add(filename)
    
    print(f"Codes mapping to {target_sku}:")
    for orig, companies in mapping.items():
        print(f"  {orig} -> {companies}")

if __name__ == "__main__":
    analyze()
