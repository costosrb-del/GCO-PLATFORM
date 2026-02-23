
import os
import sys
from dotenv import load_dotenv

# Load env from backend/.env
load_dotenv(dotenv_path="backend/.env")

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.analytics import calculate_average_sales

def test_fix():
    print("Testing calculate_average_sales with new cache logic...")
    
    # 30 days window
    averages, trends, report = calculate_average_sales(days=30, split_by_company=True)
    
    target_sku = "7702"
    
    print("\n--- Results for SKU 7702 ---")
    
    for company, data in averages.items():
        avg = data.get(target_sku, 0)
        print(f"Company: {company}")
        print(f"  Average: {avg:.2f}")
        
        # Check audit info
        audit = report["companies"].get(company, "N/A")
        print(f"  Audit/Count: {audit}")
        
    print("\n--- Audit Report ---")
    print(report)

if __name__ == "__main__":
    test_fix()
