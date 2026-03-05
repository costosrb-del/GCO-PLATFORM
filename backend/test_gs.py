import os
import sys

# Add current dir to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.utils import fetch_google_sheet_inventory
from app.services.config import get_google_sheet_url

url = get_google_sheet_url()
print("URL:", url)
try:
    data = fetch_google_sheet_inventory(url)
    print("Fetched items:", len(data))
    for item in data[:5]:
        print(item)
except Exception as e:
    import traceback
    traceback.print_exc()
