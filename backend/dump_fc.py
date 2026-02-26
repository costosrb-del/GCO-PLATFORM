import sys; sys.path.append('.')
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_documents
import json
c = get_config()[0]
token = get_auth_token(c['username'], c['access_key'])
res = get_documents(token, 'purchases', '2026-02-01', '2026-02-28', 1, 1)
with open("fc_item_dump.json", "w", encoding="utf-8") as f:
    json.dump(res['results'][0]['items'], f, indent=2)
