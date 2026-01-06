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
# Import analytics service
from app.services.analytics import calculate_average_sales

router = APIRouter(prefix="/inventory", tags=["inventory"])

# Helper function moved to module level for shared use
def process_company(company, force_refresh=False):
    try:
        # Check for configuration validity first
        if not company.get("valid", True):
            return [], f"Empresa '{company['name']}' tiene configuración incompleta (falta Usuario o API Key)."

        cache_key = f"inventory_{company['username']}.json"
        
        # 1. Try Cache (if not forced)
        if not force_refresh:
            cached = cache.load(cache_key)
            if cached:
                # Check TTL (15 minutes = 900 seconds)
                age = time.time() - cached.get("timestamp", 0)
                if age < 900:
                    # print(f"Using cache for {company['name']} (Age: {int(age)}s)")
                    return cached.get("data", []), None
                # else:
                #     print(f"Cache expired for {company['name']} (Age: {int(age)}s)")

        # 2. Fetch Fresh Data
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
        
        # 3. Save to Cache
        cache.save(cache_key, {
            "timestamp": time.time(),
            "data": c_data
        })
        
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
    filtered_data = []
    
    # Allowed warehouses for viewer (Case insensitive logic below)
    allowed_terms = ["rionegro", "libre", "sin ingresar", "sin asignar"]
    
    for item in data:
        wh_name = str(item.get("warehouse_name", "")).strip().lower()
        
        # Strict inclusion check
        if any(term in wh_name for term in allowed_terms):
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

    # 0. Try Cache First
    if not force_refresh:
        cached_data = cache.load(cache_key)
        if cached_data:
            # Check TTL for global snapshot (e.g. 15 minutes)
            last_ts = cached_data.get("timestamp", 0) # Use get() to avoid crash if missing
            if isinstance(last_ts, (int, float)) and (time.time() - last_ts) < 900:
                print(f"Serving inventory from CACHE (Age: {int(time.time() - last_ts)}s)")
                return filter_for_user(cached_data, user.get("role"))
            else:
                 print("Global cache expired. Refreshing...")

    # 1. Fetch Siigo Data
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(companies) + 2) as executor:
        future_to_company = {executor.submit(process_company, c, force_refresh): c for c in companies}
        
        for future in concurrent.futures.as_completed(future_to_company):
            res_data, res_err = future.result()
            if res_data:
                all_data.extend(res_data)
            if res_err:
                errors.append(res_err)

    # 2. Fetch Google Sheets Data
    sheet_url = os.getenv("GSHEET_INVENTORY_URL") or os.getenv("GOOGLE_SHEET_URL")
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
def stream_inventory_updates(
    user: dict = Depends(verify_token),
    force_refresh: bool = False
):
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
            future_to_company = {executor.submit(process_company, c, force_refresh): c for c in companies}
            completed_count = 0
            
            for future in concurrent.futures.as_completed(future_to_company):
                company = future_to_company[future]
                res_data, res_err = future.result()
                
                if res_data:
                    all_data_accumulated.extend(res_data)
                if res_err:
                    errors.append(res_err)
                
                completed_count += 1
                completed_count += 1
                progress = int((completed_count / total_steps) * 100)
                msg = f"Cargado {company.get('name', 'Empresa')}"
                payload = json.dumps({'progress': progress, 'message': msg})
                yield f"data: {payload}\n\n"

        # 2. Fetch Google Sheets
        yield f"data: {json.dumps({'progress': 90, 'message': 'Cargando Inventario Externo...'})}\n\n"
        sheet_url = os.getenv("GSHEET_INVENTORY_URL") or os.getenv("GOOGLE_SHEET_URL")
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

@router.get("/analysis/sales-averages")
def get_sales_averages(
    user: dict = Depends(verify_token), 
    days: int = 30,
    force_refresh: bool = False
):
    """
    Returns a dictionary of {SKU: daily_average_sales} based on the last 'days' of sales (FV).
    This is a heavy operation, cached indefinitely until force_refresh=True.
    """
    # Optional: Check if user has permission
    # if user.get("role") not in ["admin", "wholesaler"]: ... 
    
    cache_key = "sales_averages.json"

    # 1. Try Cache
    if not force_refresh:
        cached = cache.load(cache_key)
        # Verify if cached data matches requested 'days' window
        if cached and cached.get("days") == days:
             # print("Serving sales averages from CACHE")
             return cached

    try:
        averages, audit = calculate_average_sales(days=days)
        result = {
            "days": days,
            "averages": averages,
            "audit": audit,
            "timestamp": time.time()
        }
        
        # 2. Save Cache
        cache.save(cache_key, result)
        
        return result
    except Exception as e:
        print(f"Error in sales averages endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from app.services.pdf_generator import create_inventory_pdf_bytes
from fastapi.responses import Response

@router.post("/export/pdf")
def export_inventory_pdf(
    items: List[dict],
    user: dict = Depends(verify_token)
):
    """
    Generates a PDF report from the provided list of inventory items.
    """
    try:
        pdf_bytes = create_inventory_pdf_bytes(items)
        
        filename = f"Reporte_Inventario_{time.strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        print(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")
