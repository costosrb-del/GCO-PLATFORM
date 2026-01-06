from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

def test_gap_logic():
    print("--- Testing Smart Gap Detection ---")

    # Mock Data: Jan 2024 and March 2024 are present. Feb is MISSING.
    db_data = [
        {"date": "2024-01-15"},
        {"date": "2024-03-10"}
    ]
    
    start_date = "2024-01-01"
    end_date = "2024-04-30"
    
    print(f"Request: {start_date} to {end_date}")
    print("Cache has: Jan 2024, Mar 2024. (Feb and April are missing)")
    
    # --- LOGIC COPY START ---
    try:
        # 1. Map existing content by YYYY-MM
        existing_months = set()
        if db_data:
            existing_months = {x['date'][:7] for x in db_data if x.get('date')}
        
        req_start = datetime.strptime(start_date, "%Y-%m-%d")
        req_end = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Normalize to Month Start for iteration
        curr = req_start.replace(day=1) 
        target_end = req_end.replace(day=1)
        
        missing_months_start = None
        fetch_ranges = []
        
        while curr <= target_end:
            month_key = curr.strftime("%Y-%m")
            
            # Check if this month is missing
            if month_key not in existing_months:
                if missing_months_start is None:
                    missing_months_start = curr
            else:
                # We found data! Close previous gap if exists
                if missing_months_start:
                    # End of gap is LAST DAY of PREVIOUS month
                    gap_end_date = curr - timedelta(days=1)
                    
                    # Clamp start
                    g_start_str = missing_months_start.strftime("%Y-%m-%d")
                    if missing_months_start.year == req_start.year and missing_months_start.month == req_start.month:
                        if g_start_str < start_date: g_start_str = start_date
                        
                    g_end_str = gap_end_date.strftime("%Y-%m-%d")
                    if g_end_str > end_date: g_end_str = end_date
                    
                    print(f"Hole Detected: {g_start_str} -> {g_end_str}")
                    fetch_ranges.append((g_start_str, g_end_str))
                    missing_months_start = None
            
            # Next month
            curr += relativedelta(months=1)
        
        # Close final gap if open
        if missing_months_start:
            # End of range
            last_day_of_req = req_end
            
            g_start_str = missing_months_start.strftime("%Y-%m-%d")
            if missing_months_start.year == req_start.year and missing_months_start.month == req_start.month:
                if g_start_str < start_date: g_start_str = start_date
                
            g_end_str = last_day_of_req.strftime("%Y-%m-%d")
            
            print(f"Missing Range (End): {g_start_str} -> {g_end_str}")
            fetch_ranges.append((g_start_str, g_end_str))
            
    except Exception as e:
        print(f"Error: {e}")
    # --- LOGIC COPY END ---

    print("\nCalculated Ranges to Fetch:")
    for r in fetch_ranges:
        print(r)

    # Verification
    # Expect: 
    # 1. Feb 1 -> Feb 29 (Hole)
    # 2. April 1 -> April 30 (End)
    
    expected_feb = ("2024-02-01", "2024-02-29")
    expected_apr = ("2024-04-01", "2024-04-30")
    
    if expected_feb in fetch_ranges and expected_apr in fetch_ranges:
         print("\n✅ TEST PASSED: Feb Hole and April End detected.")
    else:
         print("\n❌ TEST FAILED.")

if __name__ == "__main__":
    test_gap_logic()
