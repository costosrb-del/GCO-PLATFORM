import requests
import json
from app.services.config import get_config
from app.services.auth import get_auth_token

company = get_config()[0]
token = get_auth_token(company['username'], company['access_key'])

# Test SSE Endpoint
url = f"http://127.0.0.1:8000/movements/stream?start_date=2026-02-01&end_date=2026-02-05&companies={company['name']}&token={token}"
# Wait, frontend hits /api/movements/stream or /movements/stream?
url = f"http://127.0.0.1:8000/movements/stream?start_date=2026-02-01&end_date=2026-02-05&companies={company['name']}&token={token}"

try:
    r = requests.get(url, stream=True)
    print("Status:", r.status_code)
    for line in r.iter_lines():
        if line:
            print(line.decode('utf-8'))
except Exception as e:
    print(e)
