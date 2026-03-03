import pandas as pd
from typing import Dict, Any, List
import concurrent.futures
import re

from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_consolidated_movements

def normalize_company_name(raw_name: str) -> str:
    rn = str(raw_name).upper().strip()
    if "RAICES" in rn: return "RAICES ORGANICAS"
    if "HECHIZO" in rn: return "HECHIZO DE BELLEZA"
    if "ARMONIA" in rn: return "ARMONIA C."
    if "RITUAL" in rn: return "RITUAL BOTANICO"
    if "HUMAN" in rn or "HUIMAN" in rn: return "GRUPO HUMAN"
    if "ALMA" in rn: return "ALMAVERDE"
    return rn

def normalize_invoice(inv: str) -> str:
    if not inv: return ""
    s = str(inv).upper().strip()
    for prefix in ["FV-", "FV ", "FACTURA-", "FACTURA ", "FV", "F.V.", "HU-"]:
        if s.startswith(prefix):
            s = s[len(prefix):]
    s = s.replace(" ", "-")
    return s

def normalize_sku(sku: str) -> str:
    s = str(sku).upper().strip()
    if "SD15" in s:
        return "SD15"
    digits = re.sub(r'\D', '', s)
    if digits:
         return digits
    return s 

def get_conciliacion_data(url: str, start_date: str, end_date: str, exclude_almaverde: bool = False) -> Dict[str, Any]:
    # 1. Fetch Siigo FVs
    all_companies = get_config()
    target_companies = [c for c in all_companies if c.get("valid", True)]
    
    if exclude_almaverde:
         target_companies = [c for c in target_companies if "ALMA" not in c.get("name", "").upper()]
    
    siigo_data = []
    
    def fetch_siigo(company):
        c_name = company.get("name")
        auth_token = get_auth_token(company.get("username"), company.get("access_key"))
        if not auth_token: return []
        
        docs_fv = get_consolidated_movements(auth_token, start_date, end_date, selected_types=["FV"])
        for d in docs_fv: d["company"] = c_name
        
        docs_nc = get_consolidated_movements(auth_token, start_date, end_date, selected_types=["NC"])
        for d in docs_nc: d["company"] = c_name
        
        return docs_fv + docs_nc
        
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(5, len(target_companies)+1)) as executor:
        futures = {executor.submit(fetch_siigo, c): c for c in target_companies}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res: siigo_data.extend(res)
        
    siigo_invoices = {}
    for row in siigo_data:
        inv = row.get("doc_number")
        if not inv: continue
        
        inv_clean = normalize_invoice(inv)
        comp = row.get("company", "Desconocida")
        comp_norm = normalize_company_name(comp)
        
        code_raw = str(row.get("code", "")).strip().upper()
        code = normalize_sku(code_raw)
        qty = float(row.get("quantity", 0))
        doc_type = row.get("doc_type", "FV")
        
        if "HUMAN" in comp_norm.upper() and inv_clean.startswith("2-"):
             continue 
             
        affected_inv_clean = inv_clean
        if doc_type == "NC":
            obs = str(row.get("observations", "")).upper()
            m = re.search(r'(?:FV|FACTURA)[\s-]*(\d+-\d+|\d+)', obs)
            if m:
                affected_inv_clean = normalize_invoice(m.group(1))
                 
        key = f"{comp_norm}_{affected_inv_clean}"
        
        if key not in siigo_invoices:
            siigo_invoices[key] = {
                "empresa": comp_norm,
                "invoice": affected_inv_clean,
                "date": row.get("date"),
                "client": row.get("client"),
                "total": row.get("doc_total_value", 0),
                "items": {}
            }
            
        if code:
             if doc_type == "NC":
                  siigo_invoices[key]["items"][code] = siigo_invoices[key]["items"].get(code, 0) - abs(qty)
             else:
                  siigo_invoices[key]["items"][code] = siigo_invoices[key]["items"].get(code, 0) + qty

    # 2. Fetch Google Sheet Xlsx
    if "output=csv" in url:
        url = url.replace("output=csv", "output=xlsx")
        
    try:
        xl = pd.ExcelFile(url)
    except Exception as e:
        return {"error": f"Error abriendo documento Google Sheets: {str(e)}"}
        
    sheet_invoices = {}
    
    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        df.columns = df.columns.astype(str).str.strip()
        
        col_inv = next((c for c in df.columns if 'FACTURA' in c.upper() and 'D.' in c.upper()), None)
        if not col_inv: col_inv = next((c for c in df.columns if 'FACTURA' in c.upper()), None)
        col_code = next((c for c in df.columns if 'COD' in c.upper() and 'PRODUCTO' in c.upper()), None)
        col_qty = next((c for c in df.columns if 'CANTIDAD' in c.upper()), None)
        col_emp = next((c for c in df.columns if 'EMPRESA' in c.upper()), None)
        col_date = next((c for c in df.columns if 'FECHA' in c.upper() and 'WAP' not in c.upper()), None)
        col_client = next((c for c in df.columns if 'TERCERO EXTERNO' in c.upper() or 'CLIENTE' in c.upper()), None)
        
        if col_inv and col_qty: 
             for _, row_s in df.iterrows():
                  v_inv = row_s.get(col_inv)
                  if pd.isna(v_inv) or str(v_inv).strip() == "": continue
                  
                  v_qty = row_s.get(col_qty, 0)
                  try: v_qty = float(v_qty)
                  except: v_qty = 0
                  
                  v_code = row_s.get(col_code, "") if col_code else ""
                  if pd.isna(v_code): v_code = ""
                  
                  v_empresa = row_s.get(col_emp, sheet_name) if col_emp else sheet_name
                  curr_emp = normalize_company_name(str(v_empresa))
                  
                  if exclude_almaverde and "ALMA" in curr_emp.upper():
                      continue

                  # --- FILTRADO ESTRICTO POR FECHA (SHEETS) ---
                  date_val = str(row_s.get(col_date, "")) if col_date else ""
                  if pd.notna(row_s.get(col_date)) and hasattr(row_s.get(col_date), 'strftime'):
                      date_val = row_s.get(col_date).strftime('%Y-%m-%d')
                  
                  if date_val and date_val not in ["NaT", "nan", ""]:
                      try:
                          p_dt = pd.to_datetime(date_val, errors='coerce', dayfirst=True)
                          if pd.notna(p_dt):
                              p_dt_str = p_dt.strftime("%Y-%m-%d")
                              if not (start_date <= p_dt_str <= end_date):
                                  continue 
                      except:
                          pass
                  # --------------------------------------------

                  inv = normalize_invoice(v_inv)
                  client_val = str(row_s.get(col_client, "")) if col_client else ""
                  
                  key = f"{curr_emp}_{inv}"
                  
                  if key not in sheet_invoices:
                      sheet_invoices[key] = {
                          "empresa": curr_emp,
                          "invoice": inv,
                          "date": date_val,
                          "client": client_val,
                          "items": {}
                      }
                  
                  code_raw = str(v_code).strip().upper() if v_code else ""
                  code_str = normalize_sku(code_raw)
                  if code_str:
                       sheet_invoices[key]["items"][code_str] = sheet_invoices[key]["items"].get(code_str, 0) + v_qty
             
    matched = []
    diferencias = []
    solo_siigo = []
    solo_sheets = []
    
    for k, s_inv in siigo_invoices.items():
        if k in sheet_invoices:
            g_inv = sheet_invoices[k]
            diffs = []
            s_items = s_inv["items"]
            g_items = g_inv["items"]
            all_codes = set(s_items.keys()).union(set(g_items.keys()))
            for code in all_codes:
                sq = s_items.get(code, 0)
                gq = g_items.get(code, 0)
                if abs(sq - gq) > 0.01:
                    diffs.append(f"Producto {code}: Siigo={sq}, Sheet={gq}")
            if diffs:
                diferencias.append({
                    "empresa": s_inv["empresa"], "invoice": s_inv["invoice"], "date": s_inv["date"],
                    "client": s_inv["client"], "diffs": diffs, "siigo_items": s_items, "sheet_items": g_items
                })
            else:
                matched.append({
                    "empresa": s_inv["empresa"], "invoice": s_inv["invoice"], "date": s_inv["date"],
                    "client": s_inv["client"], "siigo_items": s_items, "sheet_items": g_items
                })
        else:
            solo_siigo.append({
                "empresa": s_inv["empresa"], "invoice": s_inv["invoice"], "date": s_inv["date"],
                "client": s_inv["client"], "siigo_items": s_inv["items"]
            })
            
    for k, g_inv in sheet_invoices.items():
        if k not in siigo_invoices:
            solo_sheets.append({
                "empresa": g_inv["empresa"], "invoice": g_inv["invoice"], "date": g_inv["date"],
                "client": g_inv["client"], "sheet_items": g_inv["items"]
            })

    return {
        "matched": matched, "diferencias": diferencias,
        "solo_siigo": solo_siigo, "solo_sheets": solo_sheets
    }
