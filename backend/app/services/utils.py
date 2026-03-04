
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
            
        # Support extracting all sheets if it's an xlsx export
        import re
        if "output=xlsx" in sheet_url:
            # For xlsx, use pd.ExcelFile directly on the URL
            # Ensure it grabs the whole workbook by stripping single/gid
            clean_url = re.sub(r'&?single=true', '', sheet_url)
            clean_url = re.sub(r'&?gid=\d+', '', clean_url)
            clean_url = clean_url.replace("?&", "?").rstrip("?")
            
            try:
                xl = pd.ExcelFile(clean_url)
                
                # Scan sheets for the best match
                valid_df = None
                for sheet_name in xl.sheet_names:
                    temp_df = xl.parse(sheet_name)
                    temp_df.columns = [str(c).strip().upper() for c in temp_df.columns]
                    
                    has_sku = any("SKU" in c or "CÓDIGO" in c or "CODIGO" in c for c in temp_df.columns)
                    has_qty = any("CANTIDAD" in c or "LIBRE" in c or "DISPONIBLE" in c for c in temp_df.columns)
                    
                    if has_sku and has_qty:
                        valid_df = temp_df
                        break
                        
                if valid_df is not None:
                    df = valid_df
                else:
                    raise ValueError(f"No se detectaron las columnas requeridas (SKU o CODIGO, y CANTIDAD o LIBRE) en ninguna de las pestañas del archivo. Pestañas analizadas: {xl.sheet_names}")
                    
            except ValueError as e:
                raise e
            except Exception as e:
                raise ValueError(f"El link configurado no es un archivo válido de Google Sheets publicado o no tiene permisos de lectura: {str(e)}")
        else:
            # Fallback for CSV
            response = requests.get(sheet_url)
            response.raise_for_status()
            df = pd.read_csv(io.StringIO(response.content.decode("utf-8")))
            df.columns = [str(c).strip().upper() for c in df.columns]
        
        # Mapping variations
        sku_col = next((c for c in df.columns if "SKU" in c or "CÓDIGO" in c or "CODIGO" in c), None)
        qty_col = next((c for c in df.columns if "CANTIDAD" in c or "LIBRE" in c or "DISPONIBLE" in c), None)
        name_col = next((c for c in df.columns if "NOMBRE" in c or "PRODUCTO" in c or "ARTICULO" in c), None)

        if not sku_col or not qty_col:
            raise ValueError(f"No se detectaron las columnas requeridas (SKU o CODIGO, y CANTIDAD o LIBRE). Columnas detectadas: {list(df.columns)}")

        # Reconstruct DF with found columns
        df_final = pd.DataFrame()
        df_final["code"] = df[sku_col]
        df_final["name"] = df[name_col] if name_col else "Sin Nombre"
        df_final["quantity"] = df[qty_col]
        df = df_final
        
        external_data = []
        for index, row in df.iterrows():
            try:
                code = str(row["code"]).strip()
                name = str(row["name"]).strip()
                
                # Check for "nan" 
                if not code or code.lower() in ("nan", "none", ""):
                    continue
                    
                # Clean quantity logic
                qty_raw = row["quantity"]
                if pd.isna(qty_raw):
                    qty = 0.0
                elif isinstance(qty_raw, (int, float)):
                    qty = float(qty_raw)
                else:
                    qty_str = str(qty_raw).strip()
                    if qty_str and qty_str.lower() not in ("nan", "none", ""):
                        # Asume formato latino: punto para miles, coma para decimales
                        qty_str = qty_str.replace(".", "")
                        qty_str = qty_str.replace(",", ".")
                        # remove non numeric except dot and minus
                        qty_str = re.sub(r'[^\d.-]', '', qty_str)
                        if qty_str in ("", "-", "."):
                             qty = 0.0
                        else:
                             qty = float(qty_str)
                    else:
                        qty = 0.0

                if not name or name.lower() in ("nan", "none", ""):
                    name = "Sin Nombre Externo"

                external_data.append({
                    "company_name": "Inventario Externo",
                    "code": normalize_sku(code),
                    "name": name, 
                    "warehouse_name": "Sin Ingresar", # Google Sheets = Bodega Libre -> Renamed to Sin Ingresar
                    "quantity": qty
                })
            except Exception as e:
                print(f"Skipping row {index} due to error: {e}")
                continue 
                
        return external_data
        
    except ValueError as e:
        # Re-raise user friendly errors
        raise e
    except Exception as e:
        print(f"Error fetching Google Sheet: {e}")
        raise ValueError(f"Ocurrió un error leyendo el documento: {str(e)}")

