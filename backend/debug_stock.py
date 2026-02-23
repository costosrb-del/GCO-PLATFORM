
import json
import os

def analyze():
    path = r"C:\tmp\gco_local_cache\inventory_snapshot.json"
    if not os.path.exists(path):
        print("Snapshot file missing.")
        return
        
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        items = data.get("data", [])
        
        target = "7702"
        hits = [i for i in items if i.get("code") == target]
        
        print(f"Occurrences of {target}:")
        total = 0
        for i in hits:
            q = i.get('quantity', 0)
            print(f"  [{i.get('company_name')}] [{i.get('warehouse_name')}] : {q}")
            total += q
        
        print(f"\nTOTAL CALCULATED: {total}")

if __name__ == "__main__":
    analyze()
