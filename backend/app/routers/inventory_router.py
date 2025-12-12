from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
import concurrent.futures
import json
import time
import os

from app.services.inventory import get_all_products
from app.services.auth import get_auth_token
from app.services.config import get_config
from app.services.utils import fetch_google_sheet_inventory
from app.services.cache import cache
from app.routers.auth_router import verify_token

router = APIRouter(prefix="/inventory", tags=["inventory"])

# Helper function moved to module level for shared use
def process_company(company):
    try:
        # Check for configuration validity first
        if not company.get("valid", True):
            return [], f"Empresa '{company['name']}' tiene configuración incompleta (falta Usuario o API Key)."

        token = get_auth_token(company["username"], company["access_key"])
        if not token:
            return [], f"No se pudo autenticar '{company['name']}'. Verifique credenciales."
        
        c_data = []
        products = get_all_products(token)
        if products:
            for p in products:
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
        return c_data, None
    except Exception as e:
        print(f"Error processing {company['name']}: {e}")
        return [], f"Error en '{company['name']}': {str(e)}"

def filter_for_user(result_dict, role):
    """
    Filters inventory data based on user role.
    Viewer: Only 'Bodega Principal Rionegro', 'Bodega Libre', 'Sin Bodega', 'N/A'
    """
    if role != "viewer":
        return result_dict
    
    data = result_dict.get("data", [])
    allowed_warehouses = ["bodega principal rionegro", "sin ingresar"]
    
    filtered_data = []
    for item in data:
        wh_name = str(item.get("warehouse_name", "")).lower()
        
        is_allowed = False
        if wh_name in allowed_warehouses:
             is_allowed = True
        elif "bodega principal rionegro" in wh_name:
             is_allowed = True
        elif "bodega libre" in wh_name:
             is_allowed = True
        
        if is_allowed:
            filtered_data.append(item)
            
    return {
        "count": len(filtered_data),
        "data": filtered_data,
        "errors": result_dict.get("errors", [])
    }

@router.get("/")
def get_consolidated_inventory(
    user: dict = Depends(verify_token),
    force_refresh: bool = False
):
    cache_key = "inventory_snapshot.json"
    
    companies = get_config()
    all_data = []
    errors = []

    # 1. Fetch Siigo Data
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(companies) + 2) as executor:
        future_to_company = {executor.submit(process_company, c): c for c in companies}
        
        for future in concurrent.futures.as_completed(future_to_company):
            res_data, res_err = future.result()
            if res_data:
                all_data.extend(res_data)
            if res_err:
                errors.append(res_err)

    # 2. Fetch Google Sheets Data
    sheet_url = os.getenv("GSHEET_INVENTORY_URL")
    if sheet_url:
        try:
            gs_data = fetch_google_sheet_inventory(sheet_url)
            if gs_data:
                all_data.extend(gs_data)
        except Exception as e:
            msg = f"Error cargando Google Sheet: {str(e)}"
            errors.append(msg)
            print(msg)

    final_result = {
        "count": len(all_data),
        "data": all_data,
        "errors": errors
    }
    
    # Save Snapshot (optional if we are disabling cache reading, but keeping writing is fine)
    if all_data:
        cache.save(cache_key, final_result)

    return filter_for_user(final_result, user.get("role"))

@router.get("/stream")
def stream_inventory_updates(user: dict = Depends(verify_token)):
    # Generator function for SSE
    def event_stream():
        companies = get_config()
        # all_data = [] # Not needed if we just stream
        all_data_accumulated = []
        errors = []
        total_steps = len(companies) + 1 # +1 for Google Sheets
        
        yield f"data: {json.dumps({'progress': 0, 'message': 'Iniciando carga de inventario...'})}\n\n"

        # 1. Fetch Siigo Data (Parallel with manual tracking)
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(companies) + 2) as executor:
            future_to_company = {executor.submit(process_company, c): c for c in companies}
            completed_count = 0
            
            for future in concurrent.futures.as_completed(future_to_company):
                company = future_to_company[future]
                res_data, res_err = future.result()
                
                if res_data:
                    all_data_accumulated.extend(res_data)
                if res_err:
                    errors.append(res_err)
                
                completed_count += 1
                progress = int((completed_count / total_steps) * 100)
                yield f"data: {json.dumps({'progress': progress, 'message': f'Cargado {company['name']}'})}\n\n"

        # 2. Fetch Google Sheets
        yield f"data: {json.dumps({'progress': 90, 'message': 'Cargando Inventario Externo...'})}\n\n"
        sheet_url = os.getenv("GSHEET_INVENTORY_URL")
        if sheet_url:
            try:
                gs_data = fetch_google_sheet_inventory(sheet_url)
                if gs_data:
                    all_data_accumulated.extend(gs_data)
            except Exception as e:
                errors.append(f"Error Sheet: {str(e)}")
        
        # Finalize
        final_result = {
            "count": len(all_data_accumulated),
            "data": all_data_accumulated,
            "errors": errors
        }
        
        # Filter before sending final payload
        filtered = filter_for_user(final_result, user.get("role"))
        
        yield f"data: {json.dumps({'progress': 100, 'message': 'Finalizado', 'complete_data': filtered})}\n\n"

    return StreamingResponse(
        event_stream(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
