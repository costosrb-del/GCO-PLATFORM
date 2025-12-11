import requests
import json

def test_backend():
    url = "http://localhost:8000/movements/"
    params = {
        "start_date": "2024-01-01",
        "end_date": "2025-12-31"
    }
    headers = {
        "Authorization": "Bearer any_token_value"
    }

    try:
        print(f"Testing {url}...")
        response = requests.get(url, params=params, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Count: {data.get('count')}")
            print("DEBUG LOGS:")
            for log in data.get("debug", []):
                print(f" - {log}")
            
            if data.get("error"):
                print(f"ERROR RETURNED: {data.get('error')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Connection Failed: {e}")

if __name__ == "__main__":
    test_backend()
