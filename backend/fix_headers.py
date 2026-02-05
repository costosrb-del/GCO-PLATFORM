
import sys
import os
import gspread
from google.oauth2.service_account import Credentials

creds_path = os.path.join(os.getcwd(), "google_credentials.json")
scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
client = gspread.authorize(creds)

sheet_id = "1ErpsHhGGsz8gJ9l1IixSiHDqHdk41OPJTwH8IVJ2KGk"
sheet = client.open_by_key(sheet_id).get_worksheet(0)

print(f"Updating headers for sheet: {sheet.title}")

# My Schema
new_headers = [
    "CUC", 
    "NIT", 
    "NOMBRE", 
    "TELEFONO", 
    "CORREO", 
    "CATEGORIA", 
    "EMPRESA", 
    "CIUDAD", 
    "DEPARTAMENTO"
]

# Update Row 1
sheet.update("A1:I1", [new_headers])
print("Headers updated successfully!")
print("Current Row 1:", sheet.row_values(1))
