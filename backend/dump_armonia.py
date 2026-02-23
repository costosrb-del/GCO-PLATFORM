
import json
import os
from app.services.utils import normalize_sku

def dump():
    c_name = "ARMONIA COSMETICA S.A.S."
    path = rf"C:\tmp\gco_local_cache\history_{c_name}.json"
    start_str = "2026-01-31"
    end_str = "2026-02-15"
    selected_types = ["FV", "NC"]

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Dumping all {selected_types} for {c_name} in [{start_str}, {end_str}]:")
    for m in data:
        dt = m.get("date", "")
        tp = m.get("doc_type", "")
        if tp in selected_types and start_str <= dt <= end_str:
            cd = m.get("code", "")
            norm = normalize_sku(cd)
            print(f"  {dt} {tp} {cd} -> {norm} : {m.get('quantity')}")

dump()
