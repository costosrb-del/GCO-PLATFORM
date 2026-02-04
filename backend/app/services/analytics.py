
from datetime import datetime, timedelta
import concurrent.futures
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_consolidated_movements
from app.services.utils import normalize_sku

def calculate_average_sales(days=30, split_by_company=False):
    """
    Calculates the average daily sales for each product (SKU) over the last 'days'.
    Sources data from "FV" (Factura de Venta) documents across all companies.
    
    If split_by_company=True, returns { "Company Name": { "SKU": avg }, ... }
    Else returns { "SKU": global_avg }
    """
    # Calculate window: 20 days starting from YESTERDAY.
    # Exclude today to avoid partial data affecting the average.
    today = datetime.now()
    end_date = today - timedelta(days=1)
    
    # FIXED: Subtract (days - 1) because the range [start, end] is inclusive.
    start_date = end_date - timedelta(days=days - 1)
    
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # We only care about Sales Invoices
    selected_types = ["FV"] 
    
    companies = get_config()
    
    print(f"[DEBUG] Calculating averages from {start_str} to {end_str} (Split: {split_by_company})") # DEBUG
    
    # Audit Metadata
    audit_report = {
        "start_date": start_str,
        "end_date": end_str,
        "days_window": days,
        "formula": f"Sum(Qty) / {days}",
        "companies": {},
        "total_movements": 0
    }

    # Data structure to hold raw totals:
    # Global: { "SKU": total_qty }
    # Split: { "Company A": { "SKU": total_qty }, ... }
    
    global_totals = {}
    split_totals = {} # { "Company": { "SKU": qty } }

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
                    audit_report["total_movements"] += count
                    
                    # Aggregate
                     # Aggregate
                    if split_by_company:
                        if company_name not in split_totals:
                            split_totals[company_name] = {}
                        
                        for mov in movements:
                            sku = normalize_sku(mov.get("code"))
                            if not sku: continue
                            qty = abs(float(mov.get("quantity", 0)))
                            m_date = mov.get("date", "") # Expecting YYYY-MM-DD
                            
                            if sku not in split_totals[company_name]:
                                split_totals[company_name][sku] = {"total": 0.0, "history": []}
                                
                            split_totals[company_name][sku]["total"] += qty
                            split_totals[company_name][sku]["history"].append({"d": m_date, "q": qty})
                    else:
                        for mov in movements:
                            sku = normalize_sku(mov.get("code"))
                            if not sku: continue
                            qty = abs(float(mov.get("quantity", 0)))
                            global_totals[sku] = global_totals.get(sku, 0.0) + qty
                else:
                     print(f"[DEBUG] {company_name}: No movements found.") # DEBUG
            except Exception as e:
                msg = f"Error: {str(e)}"
                print(f"Error calculating averages for {company_name}: {msg}")
                audit_report["companies"][company_name] = msg

    # 3. Final Averages Calculation
    # 3. Final Averages & Trends Calculation
    if split_by_company:
        final_averages = {}
        final_trends = {} # { "Company": { "SKU": "up" | "down" | "stable" } }
        
        midpoint_date = (start_date + (end_date - start_date) / 2).strftime("%Y-%m-%d")

        for c_name, c_skus in split_totals.items():
            final_averages[c_name] = {}
            final_trends[c_name] = {}
            
            for sku, data_obj in c_skus.items():
                total = data_obj["total"]
                if total > 0:
                    final_averages[c_name][sku] = round(total / days, 4)
                    
                    # Trend Calc: Split buckets by date
                    first_half = 0.0
                    second_half = 0.0
                    
                    for h_item in data_obj["history"]:
                        if h_item["d"] <= midpoint_date:
                            first_half += h_item["q"]
                        else:
                            second_half += h_item["q"]
                            
                    # Debug Print
                    if total > 5:
                        print(f"TREND DEBUG: {c_name} {sku} [1st: {first_half:.1f} vs 2nd: {second_half:.1f}]")

                    # Determine Trend
                    if second_half > first_half * 1.1:
                        final_trends[c_name][sku] = "up"
                    elif second_half < first_half * 0.9:
                        final_trends[c_name][sku] = "down"
                    else:
                        final_trends[c_name][sku] = "stable"

        return final_averages, final_trends, audit_report
    else:
        # Global
        sku_averages = {}
        for sku, total_qty in global_totals.items():
            if total_qty > 0:
                sku_averages[sku] = round(total_qty / days, 4)
        print(f"[DEBUG] Calculated averages for {len(sku_averages)} SKUs.")
        return sku_averages, {}, audit_report

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
