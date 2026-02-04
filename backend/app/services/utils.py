
import pandas as pd
import requests
import io
import re

def normalize_sku(code):
    """
    Normalizes SKU to extract the main numeric code.
    Groups variations like 7007EX, EVO-7701, 7007EXENTO, etc. into their base numeric ID.
    """
    if not code: return "N/A"
    code = str(code).strip().upper()
    
    # Keep INSUMO products as is
    if "INSUMO" in code: 
        return code

    # Remove common prefixes
    code = code.replace("EVO-", "").replace("EVO", "").replace("E-", "")
    
    # Remove common suffixes (order matters: longest first)
    # Removing "EXENTO" first avoids leaving "ENTO" if we removed "EX"
    suffixes = ["EXENTO", "EX", ".1", "-1"]
    for s in suffixes:
        if code.endswith(s):
             code = code[:-len(s)]
             break

    # 1. Try to find a 4+ digit sequence (Main standard products)
    # This captures 7701 from 'EVO-7701', '7701EXENTO', '7701.1', etc.
    match_long = re.search(r"(\d{4,})", code) # Find first sequence anywhere
    if match_long:
        return match_long.group(1)
        
    # 2. Fallback: Try to find any digit sequence (Shorter products)
    match_any = re.search(r"(\d+)", code)
    if match_any:
        return match_any.group(1)
        
    return code

def fetch_google_sheet_inventory(sheet_url):
    try:
        if "/edit" in sheet_url:
            sheet_url = sheet_url.replace("/edit", "/export?format=csv")
        
        response = requests.get(sheet_url)
        response.raise_for_status()
        
        df = pd.read_csv(io.StringIO(response.content.decode("utf-8")))
        
        # Try to find columns by name first (Case Insensitive)
        df.columns = [c.strip().upper() for c in df.columns]
        
        # Mapping variations
        sku_col = next((c for c in df.columns if "SKU" in c), None)
        qty_col = next((c for c in df.columns if "CANTIDAD" in c or "LIBRE" in c), None)
        name_col = next((c for c in df.columns if "NOMBRE" in c or "PRODUCTO" in c), None)

        if sku_col and qty_col:
            # Reconstruct DF with found columns
            df_final = pd.DataFrame()
            df_final["code"] = df[sku_col]
            df_final["name"] = df[name_col] if name_col else "Sin Nombre"
            df_final["quantity"] = df[qty_col]
            df = df_final
        else:
            # Fallback to index if column names don't match expected pattern
            # Expected columns: A=Code, B=Name, C=Quantity
            df = df.iloc[:, :3] 
            df.columns = ["code", "name", "quantity"] 
        
        external_data = []
        for index, row in df.iterrows():
            try:
                code = str(row["code"]).strip()
                name = str(row["name"]).strip()
                
                # Check for "nan" 
                if not code or code.lower() == "nan":
                    continue
                    
                # Clean quantity logic
                qty_str = str(row["quantity"]).strip()
                if qty_str and qty_str.lower() != "nan":
                    qty_str = qty_str.replace(".", "")
                    qty_str = qty_str.replace(",", ".")
                    qty = float(qty_str)
                else:
                    qty = 0.0

                if not name or name.lower() == "nan":
                    name = "Sin Nombre Externo"

                external_data.append({
                    "company_name": "Inventario Externo",
                    "code": normalize_sku(code),
                    "name": name, 
                    "warehouse_name": "Sin Ingresar", # Google Sheets = Bodega Libre -> Renamed to Sin Ingresar
                    "quantity": qty
                })
            except ValueError:
                continue 
                
        return external_data
        
    except Exception as e:
        print(f"Error fetching Google Sheet: {e}")
        return []

