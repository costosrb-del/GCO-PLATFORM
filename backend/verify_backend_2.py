
import json
import time
from datetime import datetime
from app.services.analytics import calculate_average_sales

def test():
    days = 16
    start = time.time()
    split_averages, trends, audit = calculate_average_sales(days=days, split_by_company=True)
    
    # Logic from router
    global_averages = {}
    for company_name, sku_dict in split_averages.items():
        for sku, avg_val in sku_dict.items():
            global_averages[sku] = global_averages.get(sku, 0) + avg_val
            
    for sku in global_averages:
        global_averages[sku] = round(global_averages[sku], 4)

    end = time.time()
    print(f"Time: {end - start:.2f}s")
    
    target = "7702"
    print(f"Global Average for {target}: {global_averages.get(target, 0)}")
    for c, skus in split_averages.items():
        if target in skus:
            print(f"  {c}: {skus[target]}")

if __name__ == "__main__":
    test()
