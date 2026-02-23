
import json
import os

path = r"C:\tmp\gco_local_cache\history_ARMONIA COSMETICA S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("Codes containing '7702' in Armonia since Feb 1:")
    for m in data:
        if m.get("date", "") >= "2026-02-01":
            code = str(m.get("code", ""))
            if "7702" in code:
                 print(f"  {m.get('date')} {m.get('doc_type')} {code} : {m.get('quantity')}")
