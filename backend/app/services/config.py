import os
from dotenv import load_dotenv
import sys

def load_env_file():
    # Load .env from backend root
    # script path: backend/app/services/config.py
    # .env path: backend/.env
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(base_path, ".env")
    load_dotenv(env_path)

load_env_file()

def get_config():
    companies = []
    # Support up to 20 companies
    # Support up to 20 companies
    print("Cargando configuración de empresas...")
    for i in range(1, 21):  
        # Try multiple naming conventions
        name = os.getenv(f"COMPANY_{i}_NAME")
        
        # Check USER or USERNAME
        username = os.getenv(f"COMPANY_{i}_USERNAME") or os.getenv(f"COMPANY_{i}_USER")
        
        # Check KEY or ACCESS_KEY
        access_key = os.getenv(f"COMPANY_{i}_ACCESS_KEY") or os.getenv(f"COMPANY_{i}_KEY")
        
        if name:
            is_valid = bool(username and access_key)
            if not is_valid:
                print(f"DEBUG CONFIG: Empresa {i} ({name}) incompleta. Username: {'OK' if username else 'MISSING'}, Key: {'OK' if access_key else 'MISSING'}")
            
            companies.append({
                "id": i,
                "name": name.strip(),
                # Ensure we strip potential whitespace from copy-paste
                "username": (username or "").strip(),
                "access_key": (access_key or "").strip(),
                "valid": is_valid
            })
    print(f"Total empresas encontradas: {len(companies)}")
    return companies

def get_google_sheet_url():
    """
    Returns the Google Sheet URL for external inventory.
    Now uses dynamic settings from the DB.
    """
    try:
        from app.services.settings import get_all_settings
        settings = get_all_settings()
        url = settings.get("inventory_sheet_url", "")
        if url:
            # Ensure it outputs xlsx
            if "output=csv" in url:
                url = url.replace("output=csv", "output=xlsx")
            elif "output=xlsx" not in url:
                if "?" in url:
                    url = url.split("?")[0] + "?output=xlsx"
                else:
                    url += "?output=xlsx"
            return url
    except Exception as e:
        print(f"Error loading settings for sheet url, using fallback: {e}")

    # Fallback to default
    return "https://docs.google.com/spreadsheets/d/e/2PACX-1vRDYM7-zJ4c5B1VftH2EGmL5buLTWt24mHN0oHOgYNK2zi37QNIEavPwnwpV06IKJMoPUJqea_tzOir/pub?output=xlsx"
