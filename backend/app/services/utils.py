
import pandas as pd
import requests
import io

def fetch_google_sheet_inventory(sheet_url):
    try:
        if "/edit" in sheet_url:
            sheet_url = sheet_url.replace("/edit", "/export?format=csv")
        
        response = requests.get(sheet_url)
        response.raise_for_status()
        
        df = pd.read_csv(io.StringIO(response.content.decode("utf-8")))
        
        # Expected columns: A=Code, B=Name, C=Quantity
        # If headers are arbitrary, assume by index:
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
                    "code": code,
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

