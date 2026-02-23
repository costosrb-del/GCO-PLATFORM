
import json
import os

path = r"C:\tmp\gco_local_cache\history_ARMONIA COSMETICA S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("Finding docs FV-6-420 and FV-6-419:")
    for m in data:
        if m.get("doc_number") in ["FV-6-420", "FV-6-419"]:
            print(f"  {m.get('date')} {m.get('doc_number')} {m.get('code')} : {m.get('quantity')}")
