from datetime import datetime, timedelta
from app.services.utils import normalize_sku

def get_product_history(target_sku: str, days: int, current_stock: float, movements_list: list):
    """
    Reconstructs daily stock history and sales for a specific SKU.
    
    Args:
        target_sku: Normalized SKU to analyze
        days: Number of days to look back
        current_stock: The CURRENT stock quantity in inventory
        movements_list: List of movement objects (dicts) from the last N days
        
    Returns:
        List of dicts: [{date: 'YYYY-MM-DD', stock: N, sales: N}, ...] sorted by date ASC
    """
    target_sku = normalize_sku(target_sku)
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # 1. Bucket movements by date
    # We need to distinguish IN (Purchases, Returns) vs OUT (Sales)
    # Actually, we need to know the NET change per day to reconstruct stock.
    
    daily_changes = {} # Date -> Net Change
    daily_sales = {}   # Date -> Sales Qty (Absolute)
    
    # Init buckets
    curr = start_date
    while curr <= end_date:
        d_str = curr.strftime("%Y-%m-%d")
        daily_changes[d_str] = 0.0
        daily_sales[d_str] = 0.0
        curr += timedelta(days=1)
        
    for mov in movements_list:
        # Validate SKU
        m_sku = normalize_sku(mov.get("code", ""))
        # Also check product_code if code missing
        if not m_sku: m_sku = normalize_sku(mov.get("product_code", ""))
            
        if m_sku != target_sku:
            continue
            
        d_str = mov.get("date")
        if not d_str or d_str not in daily_changes:
            continue
            
        qty = float(mov.get("quantity", 0))
        m_type = mov.get("type", "").upper() # ENTRADA / SALIDA
        
        # Determine strict impact on stock
        # ENTRADA: Stock increases (+qty)
        # SALIDA: Stock decreases (-qty)
        
        if m_type == "ENTRADA":
            daily_changes[d_str] += qty
        elif m_type == "SALIDA":
            daily_changes[d_str] -= qty
            
            # Record strictly SALES (Invoice) for the green bars
            # Assuming DocType FV is sales.
            doc_type = mov.get("doc_type", "")
            if doc_type in ["FV", "POS", "REM"]: # Add more sales types if needed
                daily_sales[d_str] += qty

    # 2. Reconstruct Backwards
    # Stock[Today] is known.
    # Stock[Yesterday] = Stock[Today] - Change[Today]
    
    # We need to iterate from Today -> Back to build the "Start of Day" stock?
    # Or "End of Day" stock.
    # Let's say the chart shows "End of Day" stock.
    
    # End Date (Today, or latest data point)
    timeline = []
    
    # Sort dates desc
    sorted_dates = sorted(daily_changes.keys(), reverse=True)
    
    running_stock = current_stock
    
    # We want to output Ascending.
    # history[Last_Date].stock = current_stock
    # history[Last_Date].sales = daily_sales[Last_Date]
    # history[Last_Date-1].stock = current_stock - change[Last_Date]
    
    temp_history = []
    
    for d_str in sorted_dates:
        # Snaphot at END of this day = running_stock
        sales = daily_sales[d_str]
        
        temp_history.append({
            "date": d_str,
            "stock": max(0, running_stock), # No negative stock in chart
            "sales": sales
        })
        
        # To get Yesterday's End Stock, we SUBTRACT today's change.
        # e.g. Today Start: 10. In: 5. Out: 3. Change: +2. End: 12.
        # Yesterday End = Today Start = 10.
        # Yesterday End = 12 - (+2) = 10. Correct.
        change = daily_changes[d_str]
        running_stock -= change
        
    # Reverse to get Chronological
    return temp_history[::-1]
