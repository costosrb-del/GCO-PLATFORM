import json
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_documents

c = next(comp for comp in get_config() if comp['name'] == 'GRUPO HUMAN PROJECT S.A.S.')
t = get_auth_token(c['username'], c['access_key'])
data = get_documents(t, 'invoices', '2026-02-01', '2026-02-05')

with open('out_fv.json', 'w', encoding='utf-8') as f:
    json.dump(data['results'][0], f, indent=2)
