
import json
import os

path = r"C:\tmp\gco_local_cache\history_ARMONIA COSMETICA S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("Large movements in Armonia:")
    for m in data:
        q = abs(float(m.get("quantity", 0)))
        if q > 100:
            print(f"  {m.get('date')} {m.get('doc_type')} {m.get('code')} : {m.get('quantity')}")
