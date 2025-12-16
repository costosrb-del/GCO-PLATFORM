
from datetime import datetime, timedelta
import concurrent.futures
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_consolidated_movements

def calculate_average_sales(days=30):
    """
    Calculates the average daily sales for each product (SKU) over the last 'days'.
    Sources data from "FV" (Factura de Venta) documents across all companies.
    """
    # Calculate window: 20 days starting from YESTERDAY.
    # Exclude today to avoid partial data affecting the average.
    today = datetime.now()
    end_date = today - timedelta(days=1)
    start_date = end_date - timedelta(days=days)
    
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # We only care about Sales Invoices
    selected_types = ["FV"] 
    
    companies = get_config()
    all_movements = []
    
    print(f"[DEBUG] Calculating averages from {start_str} to {end_str}") # DEBUG
    
    # 1. Fetch Movements from all companies
    # ...
    # Audit Metadata
    audit_report = {
        "start_date": start_str,
        "end_date": end_str,
        "days_window": days,
        "formula": f"Sum(Qty) / {days}",
        "companies": {},
        "total_movements": 0
    }

    # 1. Fetch Movements from all companies
    # ...
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(companies) + 2) as executor:
        future_to_company = {}
        
        for company in companies:
            if not company.get("valid", True):
                audit_report["companies"][company["name"]] = "Skipped (Invalid Config)"
                continue
                
            future = executor.submit(
                _fetch_company_sales, 
                company, 
                start_str, 
                end_str, 
                selected_types
            )
            future_to_company[future] = company
            
        for future in concurrent.futures.as_completed(future_to_company):
            company = future_to_company[future]
            company_name = company.get("name", "Unknown")
            try:
                movements = future.result()
                count = len(movements) if movements else 0
                audit_report["companies"][company_name] = count
                
                if movements:
                    print(f"[DEBUG] {company_name}: Fetched {count} movements.") # DEBUG
                    all_movements.extend(movements)
                else:
                     print(f"[DEBUG] {company_name}: No movements found.") # DEBUG
            except Exception as e:
                msg = f"Error: {str(e)}"
                print(f"Error calculating averages for {company_name}: {msg}")
                audit_report["companies"][company_name] = msg

    audit_report["total_movements"] = len(all_movements)
    print(f"[DEBUG] Total movements fetched: {len(all_movements)}") # DEBUG
    
    # 2. Aggregate by SKU
    sku_totals = {}
    
    for mov in all_movements:
        sku = mov.get("code")
        if not sku:
            continue
            
        qty = abs(mov.get("quantity", 0))
        # print(f"[DEBUG] SKU: {sku}, Qty: {qty}") # Optional: Verbose
        
        if sku not in sku_totals:
            sku_totals[sku] = 0.0
        sku_totals[sku] += qty
        
    # 3. Calculate Average
    sku_averages = {}
    for sku, total_qty in sku_totals.items():
        if total_qty > 0:
            sku_averages[sku] = round(total_qty / days, 4)
            
    print(f"[DEBUG] Calculated averages for {len(sku_averages)} SKUs.") # DEBUG
            
    return sku_averages, audit_report

def _fetch_company_sales(company, start_str, end_str, selected_types):
    token = get_auth_token(company["username"], company["access_key"])
    if not token:
        print(f"[DEBUG] Failed to get token for {company['name']}") # DEBUG
        return []
        
    return get_consolidated_movements(
        token, 
        start_str, 
        end_str, 
        progress_callback=None, 
        selected_types=selected_types
    )
