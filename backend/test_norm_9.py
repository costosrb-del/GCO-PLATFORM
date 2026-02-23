
from app.services.utils import normalize_sku
codes = ["51351001", "Insumo-7701", "7702EX-EVO", "EVO-7702", "7210"]
for c in codes:
    print(f"'{c}' -> '{normalize_sku(c)}'")
