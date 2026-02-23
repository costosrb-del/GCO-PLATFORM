
import json
import os
from app.services.utils import normalize_sku

path = r"C:\tmp\gco_local_cache\history_ARMONIA COSMETICA S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("ALL Armonia movements for 7702 (ANY DATE):")
    total = 0
    for m in data:
        norm = normalize_sku(m.get("code"))
        if norm == "7702":
            q = float(m.get("quantity", 0))
            print(f"  {m.get('date')} {m.get('doc_type')} {m.get('code')} : {m.get('quantity')}")
            total += q
    print(f"Grand Total: {total}")
