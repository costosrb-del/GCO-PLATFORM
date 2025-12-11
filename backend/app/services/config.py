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
    for i in range(1, 21):  
        # Try multiple naming conventions
        name = os.getenv(f"COMPANY_{i}_NAME")
        
        # Check USER or USERNAME
        username = os.getenv(f"COMPANY_{i}_USERNAME") or os.getenv(f"COMPANY_{i}_USER")
        
        # Check KEY or ACCESS_KEY
        access_key = os.getenv(f"COMPANY_{i}_ACCESS_KEY") or os.getenv(f"COMPANY_{i}_KEY")
        
        if name:
            is_valid = bool(username and access_key)
            companies.append({
                "id": i,
                "name": name.strip(),
                "username": (username or "").strip(),
                "access_key": (access_key or "").strip(),
                "valid": is_valid
            })
    return companies
