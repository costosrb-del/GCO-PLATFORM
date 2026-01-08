
import requests
import pandas as pd
import io
import sys
import os

# New URL provided by user
SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRDYM7-zJ4c5B1VftH2EGmL5buLTWt24mHN0oHOgYNK2zi37QNIEavPwnwpV06IKJMoPUJqea_tzOir/pub?gid=0&single=true&output=csv"

def debug_new_sheet():
    print(f"Fetching from: {SHEET_URL}")
    try:
        response = requests.get(SHEET_URL)
        response.raise_for_status()
        
        print(f"Status Code: {response.status_code}")
        print("--- RAW CONTENT SAMPLE (First 500 chars) ---")
        print(response.content.decode("utf-8")[:500])
        print("--------------------------------------------")
        
        df = pd.read_csv(io.StringIO(response.content.decode("utf-8")))
        print("--- DATAFRAME HEAD ---")
        print(df.head())
        print("--- DATAFRAME COLUMNS ---")
        print(df.columns.tolist())
        
        # Simulate utils.py logic
        print("\n--- SIMULATING PARSING LOGIC ---")
        
        # Expected columns: A=Code, B=Name, C=Quantity
        # Logic in utils.py: df.iloc[:, :3]
        df_proc = df.iloc[:, :3]
        df_proc.columns = ["code", "name", "quantity"]
        
        valid_count = 0
        for index, row in df_proc.iterrows():
            try:
                code = str(row["code"]).strip()
                name = str(row["name"]).strip()
                qty_str = str(row["quantity"]).strip()
                
                if not code or code.lower() == "nan":
                    continue
                    
                # Clean quantity logic
                if qty_str and qty_str.lower() != "nan":
                    qty_str = qty_str.replace(".", "") # Remove thousands separator if present
                    qty_str = qty_str.replace(",", ".") # Comma to dot
                    qty = float(qty_str)
                else:
                    qty = 0.0
                    
                # print first few valid items
                if valid_count < 5:
                    print(f"parsed -> code: {code}, name: {name}, qty: {qty}, warehouse: Sin Ingresar")
                valid_count += 1
                
            except Exception as e:
                print(f"Error parsing row {index}: {e}")
                
        print(f"\nTotal valid items found: {valid_count}")
        
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    debug_new_sheet()
