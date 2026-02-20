
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.routers.auth_router import verify_token
from app.services.config import get_config, get_google_sheet_url
from app.services.inventory import get_all_products
from app.services.utils import fetch_google_sheet_inventory, normalize_sku
from app.services.analytics import calculate_average_sales
from app.services.cache import cache
import concurrent.futures
import time
import math

PACKAGING_UNITS = {
    "3001": 68,
    "3005": 50,
    "3012": 84,
    "7007": 50,
    "7008": 50,
    "7009": 50,
    "7101": 100,
    "7210": 50,
    "7299": 70,
    "7416": 100,
    "7901": 100,
    "7957": 100,
    "7701": 25,
    "EVO-7701": 25,
    "7702": 100,
    "EVO-7702": 100,
    "7703": 150,
    "EVO-7703": 150,
}

def get_packaging_unit(sku: str) -> int:
    norm = normalize_sku(sku)
    return PACKAGING_UNITS.get(norm, PACKAGING_UNITS.get(sku, 1))

def round_to_packaging(quantity: float, sku: str, limit: float = None) -> int:
    unit = get_packaging_unit(sku)
    if unit <= 1 or quantity <= 0:
        val = int(quantity)
        if limit is not None and val > limit:
            return int(limit)
        return val
    
    boxes = round(quantity / unit)
    if boxes == 0 and quantity > 0:
        boxes = 1
        
    suggested = int(boxes * unit)
    if limit is not None and suggested > limit:
        max_boxes = int(limit / unit)
        suggested = int(max_boxes * unit)
        
    return suggested

router = APIRouter(prefix="/distribution", tags=["distribution"])

# Helper to fetch current stock for a company
def fetch_company_stock(company):
    from app.services.auth import get_auth_token
    token = get_auth_token(company["username"], company["access_key"])
    if not token:
        return company["name"], {}
    
    products = get_all_products(token)
    stock_map = {} # SKU -> Qty
    
    if products:
        for p in products:
            code = p.get("code", "N/A")
            qty = 0
            # Sum ONLY "Bodega Principal Rionegro" (or similar)
            # User Rule: "re cuerda que el stock que hay en cada empresa solo debes tener presente la bodega principal rionegro"
            if "warehouses" in p:
                for wh in p["warehouses"]:
                    wh_name = str(wh.get("name", "")).lower()
                    wh_qty = float(wh.get("quantity", 0))
                    
                    # Strict Filter: Must be the main warehouse
                    # Normalize checks
                    if "principal" in wh_name or "rionegro" in wh_name:
                         # Exclude "Averias", "Transito", "Calle 80" if simpler match fails?
                         # Usually companies have "Bodega Principal" or "Bodega Principal Rionegro"
                         # We allow "Rionegro" or "Principal" to capture it.
                         qty += wh_qty
            else:
                 # If no warehouse detail, assume total is valid? 
                 # Risk: Might include other warehouses. 
                 # But get_all_products usually returns 'warehouses' list if requested properly.
                 # If not present, we default to available_quantity, but warn if possible.
                 qty = p.get("available_quantity", 0) 
                 
            # Normalize Code to aggregate variations (e.g. merging 7701 and 7701-EVO)
            n_code = normalize_sku(code)
            stock_map[n_code] = stock_map.get(n_code, 0) + qty
            
    return company["name"], stock_map

@router.get("/proposal")
def get_distribution_proposal(
    sku: str = Query(..., description="Target SKU to distribute"),
    days_goal: int = Query(30, description="Target Days of Inventory"),
    avg_days: int = Query(30, description="Number of days to calculate sales average"),
    user: dict = Depends(verify_token)
):
    """
    Generates a smart distribution proposal for a specific SKU.
    1. Fetches available stock from Google Sheets (Source).
    2. Fetches current stock from Siigo (Destination).
    3. Fetches per-company sales velocity (custom days avg).
    4. Calculates needs and distribution.
    """
    
    # 1. Fetch Source Stock (Google Sheets)
    sheet_url = get_google_sheet_url()
    source_stock = 0.0
    source_audit = "N/A"
    
    if sheet_url:
        try:
            gs_data = fetch_google_sheet_inventory(sheet_url)
            # Filter for specific SKU
            # Sheets usually have "Bodega Libre" or "Sin Ingresar"
            # We look for the SKU in the sheets data
            for item in gs_data:
                # Normalize?
                item_sku = str(item.get("code", "")).strip()
                item_wh = str(item.get("warehouse_name", "")).lower()
                
                # Check match
                if normalize_sku(item_sku) == normalize_sku(sku):
                    # We accept stock from "Libre", "Sin Ingresar", "Externa" as SOURCE
                    # or maybe just sum everything from sheets that isn't already in Siigo?
                    # The user prompt implies: "revisar cuanto inventario ... hay en la hoja ... que es sin ingresar"
                    if "sin ingresar" in item_wh or "libre" in item_wh or "externa" in item_wh:
                         source_stock += float(item.get("quantity", 0))
                         
            source_audit = f"Found {source_stock} in External Sheets (Sin Ingresar/Libre)"
        except Exception as e:
            source_audit = f"Error fetching sheets: {e}"
            
    # 2. Fetch Sales Velocity (Per Company) - Cached if possible
    # We use dynamic avg_days
    # Note: calculate_average_sales is heavy, we should cache it
    cache_key = f"sales_averages_split_{avg_days}d.json"
    cached_avgs = cache.load(cache_key)
    
    averages_data = None
    if cached_avgs and (time.time() - cached_avgs.get("timestamp", 0) < 3600): # 1 hour cache
        averages_data = cached_avgs.get("data")
    else:
        # Re-calculate
        result_tuple = calculate_average_sales(days=avg_days, split_by_company=True)
        avg_map = result_tuple[0]
        averages_data = avg_map
        cache.save(cache_key, {"timestamp": time.time(), "data": avg_map})
        
    # 3. Fetch Current Stock (Siigo) - Realtime
    companies = get_config()
    current_stocks = {} # Company -> SKU -> Qty
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_company = {executor.submit(fetch_company_stock, c): c for c in companies}
        for future in concurrent.futures.as_completed(future_to_company):
             c_name, c_stock = future.result()
             current_stocks[c_name] = c_stock
             
    # 4. Build Proposal
    proposal = []
    
    total_needed = 0
    norm_sku = normalize_sku(sku)
    
    for company in companies:
        c_name = company["name"]
        
        # Current Stock
        curr_qty = current_stocks.get(c_name, {}).get(norm_sku, 0)
        
        # Avg Sales
        avg_daily = averages_data.get(c_name, {}).get(norm_sku, 0)
        
        # Days Remaining
        days_rem = 999
        if avg_daily > 0:
            days_rem = curr_qty / avg_daily
        elif curr_qty == 0:
            days_rem = 0
            
        # Target Calculation
        # Target Qty = Avg * Days_Goal
        # Needed = Target - Current
        target_qty = avg_daily * days_goal
        needed = max(0, target_qty - curr_qty)
        
        proposal.append({
            "company": c_name,
            "current_stock": curr_qty,
            "average_daily": avg_daily,
            "days_remaining": days_rem,
            "needed": needed,
            "suggested": 0 # To be filled
        })
        
        total_needed += needed
        
    # 5. Distribute Source Stock
    total_global_avg = sum(averages_data.get(c["name"], {}).get(norm_sku, 0) for c in companies)
    reserve_qty = total_global_avg * 5
    available_to_distribute = max(0, source_stock - reserve_qty)
    
    fill_ratio = 1.0
    if total_needed > 0:
        if available_to_distribute >= total_needed:
            fill_ratio = 1.0
        else:
            fill_ratio = available_to_distribute / total_needed
    else:
        fill_ratio = 0.0
        
    remaining_to_distribute = available_to_distribute
        
    # Order proposal by most critical first to give them the boxes if we are short
    for p in sorted(proposal, key=lambda x: x["days_remaining"]):
        if p["needed"] > 0:
            alloc_raw = p["needed"] * fill_ratio
            alloc = round_to_packaging(alloc_raw, sku, limit=remaining_to_distribute)
            
            p["suggested"] = alloc
            remaining_to_distribute -= alloc
            
            # Justification
            if p["days_remaining"] == 0 and p["average_daily"] > 0:
                 p["reason"] = "Crítico: Agotado y con venta activa."
            elif p["days_remaining"] < 5:
                p["reason"] = f"Crítico: Stock para {p['days_remaining']:.1f} días."
            elif p["days_remaining"] < days_goal / 2:
                p["reason"] = "Bajo: Reforzar stock."
            else:
                 p["reason"] = "Reabastecimiento normal."
        else:
            p["suggested"] = 0
            if p["days_remaining"] > days_goal * 1.5:
                p["reason"] = "Exceso de Stock."
            else:
                p["reason"] = "Stock suficiente."
            
    return {
        "sku": sku,
        "source_stock": source_stock,
        "source_audit": source_audit,
        "total_needed": total_needed,
        "distribution": proposal,
        "fill_ratio": fill_ratio,
        "packaging_unit": get_packaging_unit(sku)
    }

from fastapi.responses import StreamingResponse
import json

@router.get("/proposal/batch/stream")
def stream_batch_distribution_proposals(
    skus: str = Query(..., description="Comma separated SKUs"),
    days_goal: int = Query(30, description="Target Days of Inventory"),
    avg_days: int = Query(30, description="Number of days to calculate sales average"),
    user: dict = Depends(verify_token)
):
    """
    Streamed version of batch proposal to avoid timeouts.
    """
    sku_list = [s.strip() for s in skus.split(",") if s.strip()]

    def event_stream():
        try:
            yield f"data: {json.dumps({'progress': 0, 'message': 'Iniciando análisis...'})}\n\n"
            
            start_time = time.time()
            
            # 1. Fetch Source Stock
            yield f"data: {json.dumps({'progress': 10, 'message': 'Consultando Sheets...'})}\n\n"
            sheet_url = get_google_sheet_url()
            all_sheet_data = []
            if sheet_url:
                try:
                    all_sheet_data = fetch_google_sheet_inventory(sheet_url)
                except Exception as e:
                    print(f"Error fetching sheets: {e}")

            source_map = {}
            for item in all_sheet_data:
                item_sku = str(item.get("code", "")).strip()
                item_wh = str(item.get("warehouse_name", "")).lower()
                norm_sku = normalize_sku(item_sku)
                if "sin ingresar" in item_wh or "libre" in item_wh or "externa" in item_wh:
                     current = source_map.get(norm_sku, 0.0)
                     source_map[norm_sku] = current + float(item.get("quantity", 0))

            # 2. Sales Velocity
            yield f"data: {json.dumps({'progress': 30, 'message': f'Calculando Velocidad de Ventas ({avg_days} días)...'})}\n\n"
            cache_key = f"sales_averages_split_{avg_days}d.json"
            cached_avgs = cache.load(cache_key)
            averages_data = None
            
            if cached_avgs and (time.time() - cached_avgs.get("timestamp", 0) < 3600): 
                averages_data = cached_avgs.get("data")
            else:
                # This is the heavy part
                result_tuple = calculate_average_sales(days=avg_days, split_by_company=True)
                avg_map = result_tuple[0]
                averages_data = avg_map
                cache.save(cache_key, {"timestamp": time.time(), "data": avg_map})
                
            yield f"data: {json.dumps({'progress': 70, 'message': 'Consultando Stock Actual...'})}\n\n"

            # 3. Current Stock
            companies = get_config()
            current_stocks = {} 
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                future_to_company = {executor.submit(fetch_company_stock, c): c for c in companies}
                completed = 0
                for future in concurrent.futures.as_completed(future_to_company):
                     c_name, c_stock = future.result()
                     current_stocks[c_name] = c_stock
                     completed += 1

            # 4. Generate Proposals
            results = []
            for sku in sku_list:
                norm_sku = normalize_sku(sku)
                source_stock = source_map.get(norm_sku, 0.0)
                
                proposal = []
                total_needed = 0
                
                for company in companies:
                    c_name = company["name"]
                    
                    # Use Normalized SKU for lookup to ensure we match despite small variations
                    c_qty = current_stocks.get(c_name, {}).get(norm_sku, 0)

                    # Use Normalized SKU for averages too (since analytics normalizes them)
                    avg_daily = averages_data.get(c_name, {}).get(norm_sku, 0)
                    
                    days_rem = 999
                    if avg_daily > 0:
                        days_rem = c_qty / avg_daily
                    elif c_qty == 0:
                        days_rem = 0
                        
                    target_qty = avg_daily * days_goal
                    needed = max(0, target_qty - c_qty)
                    
                    proposal.append({
                        "company": c_name,
                        "current_stock": c_qty,
                        "average_daily": avg_daily,
                        "days_remaining": days_rem,
                        "needed": needed,
                        "suggested": 0 
                    })
                    total_needed += needed

                total_global_avg = sum(averages_data.get(c["name"], {}).get(norm_sku, 0) for c in companies)
                reserve_qty = total_global_avg * 5
                available_to_distribute = max(0, source_stock - reserve_qty)

                fill_ratio = 1.0
                if total_needed > available_to_distribute and total_needed > 0:
                    fill_ratio = available_to_distribute / total_needed
                elif total_needed > 0:
                     fill_ratio = 1.0 
                else:
                     fill_ratio = 0.0
                     
                remaining_to_distribute = available_to_distribute
                    
                # Re-order logic to serve most critical first when using boxes
                for p in sorted(proposal, key=lambda x: x["days_remaining"]):
                    if p["needed"] > 0:
                        alloc_raw = p["needed"] * fill_ratio
                        alloc = round_to_packaging(alloc_raw, sku, limit=remaining_to_distribute)
                        
                        p["suggested"] = alloc
                        remaining_to_distribute -= alloc
                        
                        if p["days_remaining"] < 5:
                            p["reason"] = "Crítico (<5d)"
                        elif p["days_remaining"] < days_goal / 2:
                            p["reason"] = "Bajo (<50%)"
                        else:
                             p["reason"] = "Preventivo"
                    else:
                        p["suggested"] = 0
                        p["reason"] = "OK"

                results.append({
                    "sku": sku,
                    "source_stock": source_stock,
                    "total_needed": total_needed,
                    "fill_ratio": fill_ratio,
                    "distribution": proposal,
                    "packaging_unit": get_packaging_unit(sku)
                })
                
            final_payload = {
                "count": len(results),
                "time_taken": time.time() - start_time,
                "results": results
            }
            
            yield f"data: {json.dumps({'progress': 100, 'message': 'Finalizado', 'data': final_payload})}\n\n"
        
        except Exception as e:
            print(f"Error in stream: {e}")
            yield f"data: {json.dumps({'progress': 0, 'message': f'Error Interno: {str(e)}', 'error': True})}\n\n"

    return StreamingResponse(
        event_stream(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
