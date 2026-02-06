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

import time
import random

def fetch_sheet_data():
    """
    Fetches Google Sheet data with retry logic.
    """
    max_retries = 3
    for i in range(max_retries):
        try:
            response = requests.get(SHEET_URL, timeout=30)
            response.raise_for_status()
            
            # Parse CSV with header on row 3 (index 2)
            df = pd.read_csv(io.StringIO(response.text), header=2)
            
            # Normalize headers
            df.columns = [str(c).strip().upper() for c in df.columns]
            df.rename(columns={'# SKU': 'SKU', '# INGRESO': 'INGRESO'}, inplace=True)
            
            # CRITICAL: Validate Headers
            required_cols = {'SKU', 'SALDO INICIAL', 'INGRESO'}
            missing_cols = required_cols - set(df.columns)
            if missing_cols:
                raise ValueError(f"La hoja de cálculo no tiene las columnas requeridas: {', '.join(missing_cols)}")
            
            data = {}
            for _, row in df.iterrows():
                sku = str(row.get('SKU', '')).strip()
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
                
                data[sku] = {
                    "sku": sku,
                    "initial_balance": saldo_inicial,
                    "entries": ingreso
                }
            
            if not data:
                raise ValueError("La hoja de cálculo retornó datos vacíos.")
                
            return data
            
        except Exception as e:
            print(f"Intento {i+1} fallido al obtener Sheet: {e}")
            if i < max_retries - 1:
                time.sleep(1 + random.random()) # Backoff
            else:
                print("Error crítico: No se pudo conectar con Google Sheets.")
                raise e # Propagate error to abort

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
    # Final Filter: Only specific base SKUs requested by user
    ALLOWED_BASE_SKUS = {
        "3001", "3005", "3012", "7701", "7702", "7703", "7901", "7957", 
        "7007", "7008", "7009", "7210", "7299", "7101", "7416"
    }

    # 1. Fetch Sheet Data (Robust)
    try:
        sheet_data = fetch_sheet_data()
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        raise Exception(f"Error cargando Datos Iniciales (Sheets): {str(e)}")
    
    # 2. Fetch Consolidated Inventory (Robust)
    print("Fetching Consolidated Inventory for Names & Stock...")
    from app.routers.inventory_router import get_consolidated_inventory
    admin_user = {"role": "admin", "username": "system_juego"}
    
    inv_data = []
    all_errors = []

    try:
        # SINGLE ATTEMPT: Fail Fast.
        # We relying on the internal resiliency of get_consolidated_inventory.
        # Retrying the entire batch (20+ companies) because one failed is too slow.
        try:
            inv_result = get_consolidated_inventory(user=admin_user, force_refresh=True)
            inv_data = inv_result.get("data", [])
            
            # Capture errors
            if inv_result.get("errors"):
                 all_errors.extend(inv_result.get("errors"))
        except Exception as inner_e:
             all_errors.append(f"Fallo crítico consultando inventario: {inner_e}")
                
        if not inv_data:
             # If we have no data and no errors, create generic error
             if not all_errors:
                 all_errors.append("No se pudo obtener el inventario consolidado de Siigo (Data vacía).")
                 
    except Exception as e:
        print(f"Error fetching inventory: {e}")
        all_errors.append(f"Error cargando Inventario Actual: {str(e)}")
        
    TARGET_WAREHOUSES = ["principal", "rionegro", "comercio", "exterior", "averia", "avería", "averías"]
    
    def normalize_sku(code):
        code = str(code).strip().upper()
        if "INSUMO" in code: return code
        if code.startswith("EVO"):
            code = code.replace("EVO", "").strip("-").strip()
        import re
        match_num = re.match(r"^(\d+)", code)
        if match_num: return match_num.group(1)
        return code

    # Map SKU -> Stock Details
    sku_name_map = {}
    sku_stock_info = {} # {sku: {total: 0.0, details: []}}
    processed_stock_entries = set() # (company, warehouse, raw_sku)
    
    for item in inv_data:
        raw_code = str(item.get("code", "")).strip()
        norm_code = normalize_sku(raw_code)
        
        # Optimization: Only track relevant SKUs
        if norm_code not in ALLOWED_BASE_SKUS:
            continue
            
        name = item.get("name", "Sin Nombre")
        wh_name = str(item.get("warehouse_name", "")).strip().lower()
        company_name = str(item.get("company_name", "Desconocida"))
        
        # Deduplication Check REMOVED:
        # We discovered that Siigo might return multiple products that normalize to the same code (e.g. 7701 and EVO-7701).
        # Since they are distinct entries in the 'inv_data' list (coming from inventory_router), we MUST sum them up.
        # Previously, we were skipping subsequent entries, which caused us to miss stock if a 0-quantity entry appeared before a positive-quantity entry.
        # entry_key = (company_name, wh_name, raw_code)
        # if entry_key in processed_stock_entries:
        #    continue
        # processed_stock_entries.add(entry_key)
        
        if raw_code and name != "Sin Nombre":
            if norm_code not in sku_name_map:
                sku_name_map[norm_code] = name
            
        if any(target in wh_name for target in TARGET_WAREHOUSES):
            if norm_code not in sku_stock_info: 
                sku_stock_info[norm_code] = {"total": 0.0, "details": []}
            
            qty = float(item.get("quantity", 0))
            sku_stock_info[norm_code]["total"] += qty
            sku_stock_info[norm_code]["details"].append(f"[{company_name}] {wh_name} ('{raw_code}'): {qty}")

            
    # 3. Fetch Movements from ALL Companies
    start_date, end_date = get_current_month_dates()
    companies = get_config()
    global_exits = {} # {sku: {total: 0.0, details: []}}
    
    def fetch_company_movements_audit(company):
        for attempt in range(3): # Retry up to 3 times per company
            try:
                token = get_auth_token(company["username"], company["access_key"])
                if not token: 
                    # If auth fails, retrying might help if it's a temp auth service glitch
                    time.sleep(1)
                    continue
    
                movs = get_consolidated_movements(
                    token=token, 
                    start_date=start_date, 
                    end_date=end_date, 
                    selected_types=['FV', 'NC']
                )
                
                local_data = {} # {sku: {val: 0.0, logs: []}}
                for mov in movs:
                    raw_sku = (mov.get('code') or mov.get('product_code') or "").strip()
                    norm_sku = normalize_sku(raw_sku)
                    
                    # Filter SKU Early
                    if norm_sku not in ALLOWED_BASE_SKUS:
                        continue
                    
                    wh_name = str(mov.get('warehouse', "")).lower()
                    if not any(target in wh_name for target in TARGET_WAREHOUSES):
                        continue
                    
                    qty = float(mov.get('quantity', 0))
                    m_type = mov.get('type') 
                    doc = f"{mov.get('doc_type')} {mov.get('doc_number')}"
                    date = mov.get('date')
                    
                    if norm_sku not in local_data: 
                        local_data[norm_sku] = {"val": 0.0, "logs": []}
                    
                    change = 0.0
                    if m_type == 'SALIDA':
                        change = abs(qty)
                    elif m_type == 'ENTRADA':
                        change = -abs(qty)
                    
                    local_data[norm_sku]["val"] += change
                    local_data[norm_sku]["logs"].append(f"[{date}] {doc} ({m_type}): {change} @ {wh_name}")
                        
                return local_data
                
            except Exception as e:
                print(f"Fetch error {company.get('name')} (Attempt {attempt+1}): {e}")
                time.sleep(1 + random.random()) # Backoff
                
        return None

    print(f"Fetching audit movements (Max Workers: 5)...")
    failed_companies = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_company = {executor.submit(fetch_company_movements_audit, c): c for c in companies}
        for future in concurrent.futures.as_completed(future_to_company):
            company = future_to_company[future]
            try:
                res = future.result()
                if res is None:
                    failed_companies.append(company['name'])
                else:
                    for sku, data in res.items():
                        if sku not in global_exits: 
                            global_exits[sku] = {"total": 0.0, "details": []}
                        
                        global_exits[sku]["total"] += data["val"]
                        # Prepend company name to logs
                        c_logs = [f"[{company['name']}] {l}" for l in data["logs"]]
                        global_exits[sku]["details"].extend(c_logs)
            except Exception:
                failed_companies.append(company['name'])

    if failed_companies:
        all_errors.append(f"No se pudieron obtener movimientos de: {', '.join(failed_companies)}")

    # 4. Consolidate Results
    results = []
    
    # We only care about allowed SKUs
    for sku in ALLOWED_BASE_SKUS:
        # Sheet Info - Need to find matching sheet keys (normalized)
        sheet_initial = 0.0
        sheet_entries = 0.0
        
        # This is inefficient but safe for small list
        for r_sku, s_data in sheet_data.items():
            if normalize_sku(r_sku) == sku:
                sheet_initial += s_data["initial_balance"]
                sheet_entries += s_data["entries"]
        
        name = sku_name_map.get(sku, "Sin Nombre (Siigo)")
        
        exits_info = global_exits.get(sku, {"total": 0.0, "details": []})
        exits_val = exits_info["total"]
        
        stock_info = sku_stock_info.get(sku, {"total": 0.0, "details": []})
        curr_stock = stock_info["total"]
        
        final_calculated = sheet_initial + sheet_entries - exits_val
        diff = final_calculated - curr_stock
        
        alert = "OK"
        if abs(diff) > 0.01:
            alert = "DIFFERENCE"
        
        # Build Audit Log
        audit_lines = []
        audit_lines.append(f"=== STOCK ACTUAL SIIGO: {curr_stock} ===")
        for d in stock_info["details"]:
            audit_lines.append(f"  {d}")
            
        audit_lines.append(f"\n=== SALIDAS (FV-NC): {exits_val} ===")
        if not exits_info["details"]:
            audit_lines.append("  (Sin Movimientos)")
        else:
            # Show last 20 movements if too many?
            for d in exits_info["details"]:
                audit_lines.append(f"  {d}")
                
        audit_text = "\n".join(audit_lines)
            
        results.append({
            "sku": sku,
            "name": name,
            "initial_balance": sheet_initial,
            "entries": sheet_entries,
            "exits": exits_val,
            "final_balance": final_calculated,
            "current_siigo_stock": curr_stock,
            "difference": diff,
            "alert": alert,
            "audit": audit_text
        })
        
    results.sort(key=lambda x: (x["alert"] != "DIFFERENCE", x["sku"]))
             
    return results, all_errors

    

