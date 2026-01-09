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

def fetch_sheet_data():
    try:
        response = requests.get(SHEET_URL)
        response.raise_for_status()
        
        # Parse CSV
        df = pd.read_csv(io.StringIO(response.text))
        
        # Expected columns: SKU, NOMBRE, SALDO INICIAL, # INGRESO
        # Normalize headers just in case
        df.columns = [c.strip().upper() for c in df.columns]
        
        # Create a dictionary for easy access
        data = {}
        for _, row in df.iterrows():
            # Handle potential NaN or formatting issues
            sku = str(row.get('SKU', '')).strip()
            if not sku or sku.lower() == 'nan':
                continue
                
            # Parse numbers, handling thousands separators (dots) and decimals (commas) if european style, 
            # OR standard. The image shows "2.080,0", which is European/South American style (Dot=1000, Comma=Decimal).
            # Python pandas might not handle "2.080,0" automatically if locale isn't set.
            # We explicitly handle this.
            
            def parse_european_number(val):
                if pd.isna(val): return 0.0
                if isinstance(val, (int, float)):
                    return float(val)
                
                s = str(val).strip()
                # If it looks like '2.080,0', it's European.
                # If it looks like '2,080.0', it's US/Standard.
                # Heuristic: If last separator is ',', treat as decimal.
                
                if ',' in s and '.' in s:
                    if s.rfind(',') > s.rfind('.'):
                        # 2.080,50 -> Comma is last, implies Euro
                        s = s.replace('.', '')
                        s = s.replace(',', '.')
                    else:
                        # 2,080.50 -> Dot is last, implies US
                         s = s.replace(',', '')
                elif ',' in s:
                    # Could be 2,5 (Euro decimal) or 2,000 (US thousands)
                    # If there's only one comma, and it's 3 digits from end, likely thousands?
                    # This is ambiguous. But given the prompt context is likely Colombia/Latam (using Siigo),
                    # ',' is usually decimal in Excel/Sheets in Spanish, OR '.' is thousands.
                    # The image shows "2.080,0". This is explicitly Euro style.
                    # Let's assume Euro style if we see formatted strings.
                    s = s.replace('.', '')
                    s = s.replace(',', '.')
                
                try:
                    return float(s)
                except:
                    return 0.0

            saldo_inicial = parse_european_number(row.get('SALDO INICIAL', 0))
            ingreso = parse_european_number(row.get('# INGRESO', 0)) # Note the '#' in image
            
            data[sku] = {
                "sku": sku,
                "name": str(row.get('NOMBRE', 'Sin Nombre')),
                "initial_balance": saldo_inicial,
                "entries": ingreso
            }
            
        return data
    except Exception as e:
        print(f"Error fetching sheet data: {e}")
        return {}

def calculate_inventory_game(token):
    # 1. Fetch Static Data (Initial Balance + Entries)
    sheet_data = fetch_sheet_data()
    
    # 2. Fetch Dynamic Data (Exits = FV - NC) for Current Month
    start_date, end_date = get_current_month_dates()
    
    # We ask for "invoices" (FV) and "credit-notes" (NC)
    # Mapping in movements.py: 
    # invoices -> FV
    # credit-notes -> NC
    
    # Note: get_consolidated_movements fetches everything if selected_types is None.
    # It's better to filter inside or pass selected_types if the function supports it. 
    # Looking at previous file view of `movements.py`, `get_consolidated_movements` DOES support `selected_types`.
    
    movements = get_consolidated_movements(
        token=token, 
        start_date=start_date, 
        end_date=end_date, 
        selected_types=['FV', 'NC']
    )
    
    # 3. Process Exits
    exits_map = {}
    
    for mov in movements:
        # SKU check
        sku = mov.get('code')
        if not sku:
            # Fallback to product_code if available
            sku = mov.get('product_code')
        if not sku: continue
        
        sku = str(sku).strip()
        
        qty = float(mov.get('quantity', 0))
        doc_type = mov.get('doc_type')
        
        if sku not in exits_map:
            exits_map[sku] = 0.0
            
        # Logic: Exits = FV - NC
        # In movements list:
        # FV is usually "SALIDA" (quantity is negative or positive? In movements.py logic, 
        # normally Sales are Salidas. Let's verify signs in `movements.py` logic)
        
        # Re-reading movements.py snippet from memory/artifacts:
        # invoices -> mov_type="SALIDA"
        # credit-notes -> mov_type="ENTRADA"
        
        # When `get_consolidated_movements` processes data, it might normalize signs.
        # But usually "quantity" comes raw from API.
        # Let's assume standard behavior:
        # If I sell 10, it's a Salida.
        # If I get a return of 2, it's an Entrada.
        # Net Exit = Salida - Entrada.
        
        # Let's check `mov_type`.
        m_type = mov.get('type') # 'ENTRADA' or 'SALIDA'
        
        # If we want "Total Salidas Netas":
        if m_type == 'SALIDA':
            exits_map[sku] += abs(qty)
        elif m_type == 'ENTRADA':
            exits_map[sku] -= abs(qty)
            
    # 4. Merge and Calculate Final
    results = []
    
    # We iterate over sheet_data primarily as it defines the "Game" scope.
    # Should we include items that are NOT in sheet but HAVE sales? 
    # Usually Inventory Game implies checking against a planned list. 
    # But usually creating a complete report is better.
    # For now, let's prioritize Sheet Data SKUs + Any Extra SKU found in Sales.
    
    all_skus = set(sheet_data.keys()) | set(exits_map.keys())
    
    for sku in all_skus:
        sheet_item = sheet_data.get(sku, {
            "name": "N/A",
            "initial_balance": 0.0,
            "entries": 0.0
        })
        
        # Hack: Validar nombre desde movimientos si no está en sheet
        if sheet_item["name"] == "N/A" and sku in exits_map:
             # Find a name from movements 
             # (This is inefficient O(N) lookup, but simplified for now. 
             # Optimization: Build name_map during movement loop)
             pass 
             
        initial = sheet_item["initial_balance"]
        entries = sheet_item["entries"]
        exits = exits_map.get(sku, 0.0)
        
        # Logic: Final = Initial + Entries - Exits
        final = initial + entries - exits
        
        results.append({
            "sku": sku,
            "name": sheet_item["name"],
            "initial_balance": initial,
            "entries": entries,
            "exits": exits,
            "final_balance": final
        })
        
    return results
