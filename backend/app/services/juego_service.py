import pandas as pd
import requests
import io
from datetime import datetime, timedelta
from app.services.movements import get_consolidated_movements

SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOJxkl2FTcv3uPUE8jbhPw1HgoQAIN5iWPvvsAMU1VwHVnqM5Zaes1AExyNaSIqhmAnpOLGesj6oWi/pub?gid=0&single=true&output=csv"

def get_current_month_dates():
    now = datetime.now()
    start_date = now.replace(day=1).strftime("%Y-%m-%d")
    # For end date, we can just use "now" or the last day of month. 
    # Using specific logic to get next month's first day - 1 sec would be precise, 
    # but "today" is enough for "current month so far".
    # However, user said "MES ACTUAL", so let's allow up to today.
    end_date = now.strftime("%Y-%m-%d")
    return start_date, end_date


from app.services.config import get_config
from app.services.auth import get_auth_token
import concurrent.futures

def fetch_sheet_data():
    try:
        response = requests.get(SHEET_URL)
        response.raise_for_status()
        
        # Parse CSV with header on row 3 (index 2)
        df = pd.read_csv(io.StringIO(response.text), header=2)
        
        # Normalize headers
        # Expecting: # SKU, NOMBRE, SALDO INICIAL, # INGRESO
        df.columns = [str(c).strip().upper() for c in df.columns]
        
        # Mapping for weird headers
        # Rename '# SKU' to 'SKU' if present
        df.rename(columns={'# SKU': 'SKU', '# INGRESO': 'INGRESO'}, inplace=True)
        
        data = {}
        for _, row in df.iterrows():
            sku = str(row.get('SKU', '')).strip()
            # Skip empty or NaN SKUs
            if not sku or sku.lower() == 'nan':
                continue
                
            def parse_european_number(val):
                if pd.isna(val): return 0.0
                if isinstance(val, (int, float)):
                    return float(val)
                s = str(val).strip()
                if ',' in s and '.' in s:
                    if s.rfind(',') > s.rfind('.'):
                        s = s.replace('.', '').replace(',', '.')
                    else:
                        s = s.replace(',', '')
                elif ',' in s:
                    s = s.replace('.', '').replace(',', '.')
                try:
                    return float(s)
                except:
                    return 0.0

            saldo_inicial = parse_european_number(row.get('SALDO INICIAL', 0))
            ingreso = parse_european_number(row.get('INGRESO', 0))
            
            # Note: We ignore Sheet Name as we will overwrite with Siigo Name
            data[sku] = {
                "sku": sku,
                "initial_balance": saldo_inicial,
                "entries": ingreso
            }
            
        return data
    except Exception as e:
        print(f"Error fetching sheet data: {e}")
        return {}

def fetch_company_movements(company, start_date, end_date):
    """
    Helper to fetch exits (FV - NC) for a single company.
    """
    try:
        token = get_auth_token(company["username"], company["access_key"])
        if not token: 
            return {}

        movs = get_consolidated_movements(
            token=token, 
            start_date=start_date, 
            end_date=end_date, 
            selected_types=['FV', 'NC']
        )
        
        local_exits = {}
        for mov in movs:
            sku = (mov.get('code') or mov.get('product_code') or "").strip()
            if not sku: continue
            
            qty = float(mov.get('quantity', 0))
            m_type = mov.get('type') # 'ENTRADA' or 'SALIDA'
            
            if sku not in local_exits: local_exits[sku] = 0.0
            
            if m_type == 'SALIDA':
                local_exits[sku] += abs(qty)
            elif m_type == 'ENTRADA':
                local_exits[sku] -= abs(qty)
                
        return local_exits
    except Exception as e:
        print(f"Error fetching movements for {company.get('name')}: {e}")
        return {}

def calculate_inventory_game(token_ignored=None): 
    # Token argument is ignored as we use config for all companies now.
    
    # 1. Fetch Sheet Data
    sheet_data = fetch_sheet_data()
    
    # 2. Fetch Consolidated Inventory (For Names & Current Stock)
    print("Fetching Consolidated Inventory for Names & Stock...")
    from app.routers.inventory_router import get_consolidated_inventory
    admin_user = {"role": "admin", "username": "system_juego"}
    
    try:
        # Note: This is cached, so it's fast.
        inv_result = get_consolidated_inventory(user=admin_user, force_refresh=False)
        inv_data = inv_result.get("data", [])
    except Exception as e:
        print(f"Error fetching inventory: {e}")
        inv_data = []
        
    # Build Map: SKU -> Name and SKU -> Current Stock (Target Warehouses)
    sku_name_map = {}
    sku_current_stock = {}
    target_warehouses = ["bodega principal", "bodega de comercio exterior"] # and "bodega libre"? User said "princip + com ext"
    
    for item in inv_data:
        code = str(item.get("code", "")).strip()
        name = item.get("name", "Sin Nombre")
        wh_name = str(item.get("warehouse_name", "")).strip().lower()
        
        if code and name != "Sin Nombre":
            sku_name_map[code] = name
            
        if any(target in wh_name for target in target_warehouses):
            if code not in sku_current_stock: sku_current_stock[code] = 0.0
            sku_current_stock[code] += float(item.get("quantity", 0))
            
    # 3. Fetch Movements from ALL Companies (Parallel)
    start_date, end_date = get_current_month_dates()
    companies = get_config()
    global_exits = {}
    
    print(f"Fetching movements from {len(companies)} companies...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(companies) + 1) as executor:
        future_to_company = {executor.submit(fetch_company_movements, c, start_date, end_date): c for c in companies}
        for future in concurrent.futures.as_completed(future_to_company):
            c_exits = future.result()
            # Merge exits
            for sku, qty in c_exits.items():
                if sku not in global_exits: global_exits[sku] = 0.0
                global_exits[sku] += qty

    # 4. Consolidate Results
    # Scope: Union of Sheet SKUs + Global Exits SKUs + Current Stock SKUs?
    # User said: "los codigos para la venta". Usually this means codes that exist in Siigo.
    # We will iterate over the union of all known active SKUs to be safe.
    
    all_skus = set(sheet_data.keys()) | set(global_exits.keys()) | set(sku_current_stock.keys())
    results = []
    
    for sku in all_skus:
        # Sheet Info
        sheet_item = sheet_data.get(sku, {"initial_balance": 0.0, "entries": 0.0})
        
        # Name Resolution
        name = sku_name_map.get(sku, "Sin Nombre (Siigo)")
        if name == "Sin Nombre (Siigo)":
             # Try to keep sheet name if available or leave as generic
             # But our fetch_sheet_data doesn't capture name anymore based on instruction 
             # "RELAICONALO AUTOMATICAMENTE CON LOS DATOS DE SIIGO"
             pass

        initial = sheet_item["initial_balance"]
        entries = sheet_item["entries"]
        exits = global_exits.get(sku, 0.0)
        
        final_calculated = initial + entries - exits
        
        curr_stock = sku_current_stock.get(sku, 0.0)
        diff = final_calculated - curr_stock
        
        alert = "OK"
        if abs(diff) > 0.01:
            alert = "DIFFERENCE"
            
        results.append({
            "sku": sku,
            "name": name,
            "initial_balance": initial,
            "entries": entries,
            "exits": exits,
            "final_balance": final_calculated,
            "current_siigo_stock": curr_stock,
            "difference": diff,
            "alert": alert
        })
        
    # Sort by alert status (Differences first)
    results.sort(key=lambda x: (x["alert"] != "DIFFERENCE", x["sku"]))
        
    return results
