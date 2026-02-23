
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

path = r"C:\tmp\gco_local_cache\history_ARMONIA COSMETICA S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("ALL 7702 movements in Armonia since Feb 1:")
    count = 0
    total = 0
    for m in data:
        if m.get("date", "") >= "2026-02-01":
            sku = normalize_sku(m.get("code"))
            if sku == "7702" and m.get("doc_type") in ["FV", "NC"]:
                q = float(m.get("quantity", 0))
                val = -q if m.get("doc_type") == "NC" else q
                print(f"  {m.get('date')} {m.get('doc_type')} {m.get('code')} : {m.get('quantity')} -> {val}")
                total += val
                count += 1
    print(f"Count: {count}, Total: {total}")
