
import json
import os
from app.services.utils import normalize_sku

path = r"C:\tmp\gco_local_cache\history_ARMONIA COSMETICA S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    print("All Armonia movements in Feb 2026 and their normalized SKUs:")
    for m in data:
        if m.get("date", "") >= "2026-02-01" and m.get("doc_type") in ["FV", "NC"]:
            norm = normalize_sku(m.get("code"))
            if norm == "7702":
                print(f"  {m.get('date')} {m.get('doc_type')} {m.get('code')} -> {norm} : {m.get('quantity')}")
            elif norm in ["500", "1500", "1524", "1624"]:
                # Just checking if these numbers are actually SKUs
                print(f"  {m.get('date')} {m.get('doc_type')} {m.get('code')} -> {norm} : {m.get('quantity')}")
