
import json
import os
from app.services.utils import normalize_sku

path = r"C:\tmp\gco_local_cache\history_ARMONIA COSMETICA S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("Armonia movements after Feb 8 for 7702:")
    for m in data:
        if m.get("date", "") >= "2026-02-08":
            norm = normalize_sku(m.get("code"))
            if norm == "7702":
                 print(f"  {m.get('date')} {m.get('doc_type')} {m.get('code')} -> {norm} : {m.get('quantity')}")
