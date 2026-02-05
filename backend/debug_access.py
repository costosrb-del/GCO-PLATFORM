
import sys
import os
import gspread
from google.oauth2.service_account import Credentials

# Print current directory and file existence
print(f"Current Directory: {os.getcwd()}")
creds_path = os.path.join(os.getcwd(), "google_credentials.json")
print(f"Looking for credentials at: {creds_path}")
print(f"Credentials file exists: {os.path.exists(creds_path)}")

# Scopes
scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

try:
    print("Authenticating...")
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
    print("Authentication successful.")

    print(f"Service Account Email: {creds.service_account_email}")

    # Try to open by URL instead of ID, sometimes easier to debug
    sheet_id = "1ErpsHhGGsz8gJ9l1IixSiHDqHdk41OPJTwH8IVJ2KGk"
    print(f"Attempting to open Sheet ID: {sheet_id}")
    
    try:
        sheet = client.open_by_key(sheet_id)
        print(f"SUCCESS! Opened sheet: {sheet.title}")
        print(f"Worksheets: {[ws.title for ws in sheet.worksheets()]}")
        
        # Try to read
        ws = sheet.get_worksheet(0)
        print(f"First row: {ws.row_values(1)}")
        
    except gspread.exceptions.PermissionError:
        print("\nERROR: PermissionError. The service account cannot access this sheet.")
        print("Possible reasons:")
        print("1. The sheet is not shared with the email printed above.")
        print("2. Organization policies block external sharing.")
        
    except gspread.exceptions.SpreadsheetNotFound:
        print("\nERROR: SpreadsheetNotFound. The ID might be wrong or the service account has NO access at all (sometimes returns 404 instead of 403).")
        
    # List all available sheets
    print("\nListing all accessible spreadsheets for this service account:")
    all_sheets = client.openall()
    if not all_sheets:
        print("No spreadsheets found. The service account has no access to any files.")
    else:
        for s in all_sheets:
            print(f"- {s.title} (ID: {s.id})")

except Exception as e:
    print("\nUNEXPECTED ERROR:")
    print(e)
    import traceback
    traceback.print_exc()
