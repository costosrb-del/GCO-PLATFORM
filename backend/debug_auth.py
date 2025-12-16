import requests

url = "https://api.siigo.com/auth"
payload = {
    "username": "sergiocardenas@tclasesores.com",
    "access_key": "YzI0OGUyZjAtMmUwZi00NDhlLWI1OGUtMjViOWNiMGU1NzEyOm8sQEFoZ3EwLVU="
}
headers = {
    "Content-Type": "application/json",
    "Partner-Id": "SiigoApi"
}

print(f"Testing Auth for ALMAVERDE...")
try:
    response = requests.post(url, json=payload, headers=headers, timeout=10)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("Success! Token received.")
    else:
        print(f"Failed: {response.text}")
except Exception as e:
    print(f"Error: {e}")
