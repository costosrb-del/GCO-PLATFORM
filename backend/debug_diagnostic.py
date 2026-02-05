
import sys
import os
import gspread
from google.oauth2.service_account import Credentials
import datetime

# Print current directory and file existence
print(f"Current Directory: {os.getcwd()}")
creds_path = os.path.join(os.getcwd(), "google_credentials.json")

# Scopes
scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

try:
    print("Authenticating...")
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
    print(f"Authentication successful. SA Email: {creds.service_account_email}")

    # TEST 1: Create a new sheet (Tests API enabled + Write permissions)
    print("\nTest 1: Creating a test spreadsheet...")
    try:
        new_sheet = client.create(f"Test Sheet {datetime.datetime.now()}")
        print(f"SUCCESS! Created new sheet with ID: {new_sheet.id}")
        print("Sharing this new sheet with user for verification (optional)...")
        # cleanup
        client.del_spreadsheet(new_sheet.id)
        print("Deleted test sheet.")
    except Exception as e:
        print(f"FAILED to create sheet: {e}")

    # TEST 2: Access the specific existing sheet
    sheet_id = "1ErpsHhGGsz8gJ9l1IixSiHDqHdk41OPJTwH8IVJ2KGk"
    print(f"\nTest 2: Accessing Target Sheet ID: {sheet_id}")
    
    try:
        sheet = client.open_by_key(sheet_id)
        print(f"SUCCESS! Opened sheet: {sheet.title}")
    except Exception as e:
        print(f"FAILED to open target sheet: {e}")

except Exception as e:
    print("\nUNEXPECTED FATAL ERROR:")
    print(e)
