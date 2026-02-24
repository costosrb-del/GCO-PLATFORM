import json, asyncio
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_documents

company = get_config()[0]
token = get_auth_token(company['username'], company['access_key'])
docs = get_documents(token, 'purchases', '2023-01-01', '2026-12-31', page_size=2)
if docs and docs.get('results'):
    with open('test_fc2.json', 'w', encoding='utf-8') as f:
        json.dump(docs['results'][0], f, indent=2)

