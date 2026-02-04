import sys
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Add current directory to path so 'app' module can be found
sys.path.append(os.getcwd())

from app.services.analytics import calculate_average_sales

print("Starting verification (Days=16)...")
try:
    # This will trigger the debug prints in analytics.py
    # With days=16, the midpoint split will be at 8 days.
    avgs, trends, audit = calculate_average_sales(days=16, split_by_company=True)
    print("Verification Complete.")
except Exception as e:
    print(f"Error: {e}")
