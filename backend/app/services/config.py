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
    for i in range(1, 21):  
        key_name = f"COMPANY_{i}_NAME"
        key_user = f"COMPANY_{i}_USER"
        key_access = f"COMPANY_{i}_KEY"
        
        name = os.getenv(key_name)
        username = os.getenv(key_user)
        access_key = os.getenv(key_access)
            
        if name and username and access_key:
            companies.append({
                "id": i,
                "name": name.strip(),
                "username": username.strip(),
                "access_key": access_key.strip()
            })
    return companies
