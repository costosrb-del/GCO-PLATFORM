from app.services.analytics import calculate_average_sales
import logging

# Configure logging to stdout
logging.basicConfig(level=logging.INFO)

print("Starting debug calculation...")
try:
    averages = calculate_average_sales(days=30)
    print(f"Result: {len(averages)} items found.")
    print("Sample (first 5):", list(averages.items())[:5])
except Exception as e:
    print(f"FAILED: {e}")
