from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
import concurrent.futures
import json
import time
import os

from app.services.inventory import get_all_products
from app.services.auth import get_auth_token
from app.services.config import get_config, get_google_sheet_url
from app.services.utils import fetch_google_sheet_inventory, normalize_sku
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
                    "code": normalize_sku(p.get("code", "N/A")),
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
    allowed_terms = ["rionegro", "libre", "sin ingresar", "sin asignar", "laboratorio"]
    
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
    # Limit concurrency to 5 workers to prevent API Rate Limiting (429) and network saturation
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_company = {executor.submit(process_company, c, force_refresh): c for c in companies}
        
        for future in concurrent.futures.as_completed(future_to_company):
            res_data, res_err = future.result()
            if res_data:
                all_data.extend(res_data)
            if res_err:
                errors.append(res_err)

    # 2. Fetch Google Sheets Data
    sheet_url = get_google_sheet_url()
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
    # Save Snapshot ONLY if clean run (no errors) to avoid caching partial data
    # If we have errors (e.g. one company failed), we return what we have but DO NOT cache it.
    # This ensures the next user tries to fetch everything again.
    if all_data and not errors:
        cache.save(cache_key, final_result)
    elif errors:
        print(f"Skipping cache save due to errors: {len(errors)} errors found.")

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
        sheet_url = get_google_sheet_url()
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
        # Fetch granular data (Split by company)
        split_averages, trends, audit = calculate_average_sales(days=days, split_by_company=True)
        
        # Derive Global Averages from Split Data (avoiding double DB hit)
        global_averages = {}
        for company_name, sku_dict in split_averages.items():
            for sku, avg_val in sku_dict.items():
                global_averages[sku] = global_averages.get(sku, 0) + avg_val
                
        # Round global values
        for sku in global_averages:
            global_averages[sku] = round(global_averages[sku], 4)

        result = {
            "days": days,
            "averages": global_averages, # Legacy/Default Global
            "averages_by_company": split_averages, # New Granular Data
            "trends_by_company": trends,
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

# --- HISTORY ANALYSIS ---
from datetime import datetime, timedelta
from app.services.movements import get_all_documents
from app.services.stock_history import get_product_history

@router.get("/analysis/history")
def get_inventory_history(
    sku: str,
    days: int = 30,
    current_stock: float = 0.0,
    user: dict = Depends(verify_token)
):
    """
    Returns daily stock levels vs sales for a specific SKU.
    Reconstructs history backwards from current_stock.
    """
    try:
        # Calculate Date Range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days + 5) # Buffer
        
        s_str = start_date.strftime("%Y-%m-%d")
        e_str = end_date.strftime("%Y-%m-%d")
        
        # REAL IMPLEMENTATION
        # Fetch Sales (FV) from all companies to build the sales chart
        # Note: We rely on current_stock passed by Frontend to anchor the red line.
        
        companies = get_config()
        all_movements = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_to_c = {}
            for c in companies:
                if not c.get("valid", False): continue
                
                token = get_auth_token(c["username"], c["access_key"])
                if not token: continue
                
                # Fetch Invoices (Sales)
                future_to_c[executor.submit(get_all_documents, token, "invoices", s_str, e_str)] = c.get("name")
                
            for future in concurrent.futures.as_completed(future_to_c):
                try:
                    docs = future.result()
                    if docs:
                        for d in docs:
                            for item in d.get("items", []):
                                all_movements.append({
                                    "date": d.get("date"),
                                    "code": item.get("code"),
                                    "product_code": item.get("code"), # Fallback
                                    "quantity": item.get("quantity"),
                                    "type": "SALIDA", 
                                    "doc_type": "FV"
                                })
                except Exception as e:
                    print(f"Error fetching history: {e}")

        # Now processing
        history = get_product_history(sku, days, current_stock, all_movements)
        return history
        
    except Exception as e:
        print(f"History Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
