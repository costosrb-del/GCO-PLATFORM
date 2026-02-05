
import sys
import os
import gspread
from google.oauth2.service_account import Credentials
import json

creds_path = os.path.join(os.getcwd(), "google_credentials.json")
scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
client = gspread.authorize(creds)

sheet_id = "1ErpsHhGGsz8gJ9l1IixSiHDqHdk41OPJTwH8IVJ2KGk"
sheet = client.open_by_key(sheet_id).get_worksheet(0)

print(f"Sheet Title: {sheet.title}")
all_values = sheet.get_all_values()
print(f"Total Rows: {len(all_values)}")

if len(all_values) > 0:
    print("Headers (Row 1):", all_values[0])
    
if len(all_values) > 1:
    print("Row 2 (First Data):", all_values[1])
else:
    print("NO DATA ROWS FOUND.")

# Test the service logic 'simulation'
headers = [h.lower() for h in all_values[0]] if all_values else []
print("Processed Headers:", headers)

data = []
for row in all_values[1:]:
    padded = row + [""] * (len(headers) - len(row))
    item = dict(zip(headers, padded))
    data.append(item)

print(f"Parsed Items Count: {len(data)}")
if len(data) > 0:
    print("First Parsed Item:", json.dumps(data[0], indent=2))
