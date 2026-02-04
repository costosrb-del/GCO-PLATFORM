
import requests
import json

try:
    print("Testing GET /transport/ ...")
    r = requests.get("http://localhost:8000/transport/")
    if r.status_code == 200:
        data = r.json()
        print(f"Success. Got {len(data)} records.")
        if len(data) > 0:
            print("First record:", data[0])
    else:
        print(f"Failed. Status: {r.status_code}")
        print(r.text)
except Exception as e:
    print(f"Error: {e}")
