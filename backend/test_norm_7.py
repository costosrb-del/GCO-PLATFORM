
import json
import os
from app.services.utils import normalize_sku

path = r"C:\tmp\gco_local_cache\history_ARMONIA COSMETICA S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("Movements with Qty in [500, 1000, 24, 100] in Armonia since Feb 1:")
    for m in data:
        if m.get("date", "") >= "2026-02-01":
            q = float(m.get("quantity", 0))
            if q in [500.0, 1000.0, 24.0, 100.0]:
                 norm = normalize_sku(m.get("code"))
                 print(f"  {m.get('date')} {m.get('doc_type')} {m.get('code')} -> {norm} : {m.get('quantity')}")
