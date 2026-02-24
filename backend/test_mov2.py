import asyncio, json
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_consolidated_movements

try:
    c = get_config()[0]
    t = get_auth_token(c['username'], c['access_key'])
    data = get_consolidated_movements(t, '2026-02-01', '2026-02-05')
    
    with open('out_mov2.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
except Exception as e:
    print(e)
