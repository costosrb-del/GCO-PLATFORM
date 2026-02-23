
import json
import os
from app.services.utils import normalize_sku

def dump():
    c_name = "ARMONIA COSMETICA S.A.S."
    path = rf"C:\tmp\gco_local_cache\history_{c_name}.json"
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"Dumping all movements for {c_name} in cache:")
    for m in data:
        num = m.get("doc_number", "")
        if "FV-6-4" in str(num):
             print(f"  {m.get('date')} {m.get('doc_type')} {num} {m.get('code')} : {m.get('quantity')}")

dump()
