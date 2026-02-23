
import json
import os

path = r"C:\tmp\gco_local_cache\history_RITUAL BOTANICO S.A.S..json"
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    for m in data:
        if '1624' in str(m):
            print(f"Match: {m}")
