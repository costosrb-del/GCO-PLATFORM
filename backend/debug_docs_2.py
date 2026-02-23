
import json
import os

path = r"C:\tmp\gco_local_cache\history_ARMONIA COSMETICA S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("Finding docs starting with FV-6-4 in Armonia cache:")
    for m in data:
        if str(m.get("doc_number", "")).startswith("FV-6-4"):
            print(f"  {m.get('date')} {m.get('doc_number')} {m.get('code')} : {m.get('quantity')}")
