
import json
import os

path = r"C:\tmp\gco_local_cache\history_ARMONIA COSMETICA S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("Searching for 500, 1000, 24 in Armonia:")
    for m in data:
        q = float(m.get("quantity", 0))
        if q in [500.0, 1000.0, 24.0]:
             print(f"  {m.get('date')} {m.get('doc_type')} {m.get('code')} : {m.get('quantity')}")
