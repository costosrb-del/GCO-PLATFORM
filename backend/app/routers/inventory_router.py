from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import concurrent.futures
from app.services.inventory import get_all_products
from app.services.auth import get_auth_token
from app.services.config import get_config
from app.services.utils import fetch_google_sheet_inventory # Reusing existing logic
import os

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.get("/")
def get_consolidated_inventory():
    companies = get_config()
    all_data = []
    errors = []

    # 1. Fetch Siigo Data
    def process_company(company):
        try:
            token = get_auth_token(company["username"], company["access_key"])
            if not token:
                return []
            
            c_data = []
            products = get_all_products(token)
            if products:
                for p in products:
                    # Flatten logic similar to Streamlit app
                    p_base = {
                        "code": p.get("code", "N/A"),
                        "name": p.get("name", "Sin Nombre"),
                        "company_name": company["name"],
                        "quantity": 0.0,
                        "warehouse_name": "N/A"
                    }
                    
                    if "warehouses" in p:
                        for wh in p["warehouses"]:
                            item = p_base.copy()
                            item["warehouse_name"] = wh.get("name", "Unknown")
                            item["quantity"] = float(wh.get("quantity", 0))
                            c_data.append(item)
                    else:
                        c_data.append(p_base)
            return c_data
        except Exception as e:
            print(f"Error processing {company['name']}: {e}")
            return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(companies) + 2) as executor:
        future_to_company = {executor.submit(process_company, c): c for c in companies}
        
        for future in concurrent.futures.as_completed(future_to_company):
            res = future.result()
            if res:
                all_data.extend(res)

    # 2. Fetch Google Sheets Data
    sheet_url = os.getenv("GOOGLE_SHEET_URL")
    if sheet_url:
        try:
            ext_data = fetch_google_sheet_inventory(sheet_url)
            
            # Name Enrichment Logic
            code_name_map = {}
            for item in all_data:
                if item.get("name") and item.get("name") != "Sin Nombre":
                    code_name_map[item["code"]] = item["name"]
            
            for ext_item in ext_data:
                current_name = ext_item.get("name", "")
                if (not current_name or current_name == "Sin Nombre Externo") and ext_item["code"] in code_name_map:
                    ext_item["name"] = code_name_map[ext_item["code"]]
            
            all_data.extend(ext_data)
        except Exception as e:
            print(f"Google Sheet Error: {e}")

    return {
        "count": len(all_data),
        "data": all_data
    }
