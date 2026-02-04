
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
from datetime import datetime
import uuid
import logging
import os
import json

# --- LOCAL PROTOTYPING DB STUB ---
# If Firestore fails, we use this local JSON file.
LOCAL_DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "local_transport_db.json")
LOCAL_CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "local_transport_config.json")

class LocalDB:
    def __init__(self):
        self.file_path = LOCAL_DB_FILE
        self.config_path = LOCAL_CONFIG_FILE
        if not os.path.exists(self.file_path):
            self._save([], self.file_path)
        if not os.path.exists(self.config_path):
            # Seed initial config
            seed = {
                "carriers": [
                    {"id": "c1", "name": "LEONARDO SABOGAL", "nit": "9999999", "contact": "LEONARDO DAVOGAL", "phone": "350 6214346", "status": "Activo"},
                    {"id": "c2", "name": "GRUPO LOGISTICO ESPECIALIZADO", "nit": "900614022", "contact": "DAVID MOLINA", "phone": "31695363", "status": "Activo"}
                ],
                "locations": [
                    {"id": "l1", "name": "Instins Humans Bogotá", "address": "CL 17A 68D - 38 Bogotá D.C, barrio monteviedo zona industrial"},
                    {"id": "l2", "name": "Bodega Rionegro", "address": "ZN E CENTRO LOGISTICO BG 16 DEL CRUCE DEL TABLAZO 900 MTS VIA ZONA FRANCA"}
                ]
            }
            self._save(seed, self.config_path)

    def _load(self, path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return [] if path == self.file_path else {}

    def _save(self, data, path):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, default=str)

    # --- REQUESTS ---
    def get_all_requests(self):
        data = self._load(self.file_path)
        if isinstance(data, list):
            data.sort(key=lambda x: x.get('created_at', '') or '', reverse=True)
        else:
            data = []
        return data

    def save_request(self, doc_id, doc_data):
        current = self.get_all_requests()
        existing_idx = next((i for i, d in enumerate(current) if d.get('id') == doc_id), -1)
        if existing_idx >= 0:
            current[existing_idx] = doc_data
        else:
            current.append(doc_data)
        self._save(current, self.file_path)

    def update_request(self, doc_id, fields):
        current = self.get_all_requests()
        existing = next((d for d in current if d.get('id') == doc_id), None)
        if existing:
            existing.update(fields)
            self._save(current, self.file_path)
            return existing
        return None

    def delete_request(self, doc_id):
        current = self.get_all_requests()
        new_list = [d for d in current if d.get('id') != doc_id]
        if len(new_list) < len(current):
            self._save(new_list, self.file_path)
            return True
        return False

    # --- CONFIG ---
    def get_config(self):
        return self._load(self.config_path)

    def save_config(self, new_config):
        self._save(new_config, self.config_path)

local_db = LocalDB()

# --- FIRESTORE INIT ---
# Check for serviceAccountKey.json in root
CRED_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "serviceAccountKey.json")
DB_MODE = "Local JSON"
db = None

try:
    if os.path.exists(CRED_PATH):
        if not firebase_admin._apps:
            cred = credentials.Certificate(CRED_PATH)
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        DB_MODE = "Firebase (Connected)"
        print(f"🔥 FIREBASE CONNECTED: {CRED_PATH}")
    else:
        # Check ENV
        if not firebase_admin._apps:
             try:
                 firebase_admin.initialize_app()
                 db = firestore.client()
                 DB_MODE = "Firebase (Env Var)"
             except:
                 pass
except Exception as e:
    print(f"⚠️ Firebase Connection Failed: {e}")
    db = None

if db is None:
    DB_MODE = "Local JSON (Offline)"
    print("⚠️ USING LOCAL JSON DATABASE")


COLLECTION_NAME = "transport_requests"

def get_db_status():
    return {
        "status": "connected" if db else "local_fallback", 
        "mode": DB_MODE, 
        "path": CRED_PATH if os.path.exists(CRED_PATH) else "Not Found"
    }

def get_all_requests():
    # If using Firebase and connected
    if db:
        try:
            docs = db.collection(COLLECTION_NAME).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Error fetching from Firebase: {e}")
            return local_db.get_all_requests()
            
    # Fallback to local
    return local_db.get_all_requests()

def create_request(data: dict):
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now().isoformat()
    
    # Generate Sequential ID (ST-XX)
    try:
        all_reqs = get_all_requests()
        max_id = 88 # Default start point (next will be 89)
        
        for r in all_reqs:
            # Check legacy_id first, then id
            lid = r.get('legacy_id')
            if not lid and r.get('id', '').startswith('ST-'):
                lid = r.get('id')
            
            if lid and isinstance(lid, str) and lid.startswith('ST-'):
                try:
                    num_part = int(lid.split('-')[1])
                    if num_part > max_id:
                        max_id = num_part
                except:
                    pass
        
        new_seq_id = f"ST-{max_id + 1}"
        data["legacy_id"] = new_seq_id
    except Exception as e:
        print(f"Error generating sequence ID: {e}")
        # Fallback if algo fails
        data["legacy_id"] = f"ST-{int(datetime.now().timestamp())}"

    # Default status if new
    if not data.get("status"):
        data["status"] = "Solicitado"
    
    # Save to Firebase if available
    if db:
        try:
            db.collection(COLLECTION_NAME).document(data["id"]).set(data)
            return data
        except Exception as e:
            print(f"Error saving to Firebase: {e}")
            # Fallback save locally so data isn't lost
            pass

    local_db.save_request(data["id"], data)
    return data

def update_request(req_id: str, data: dict):
    # Logic for Invoice Status update
    if "invoice_number" in data and data["invoice_number"]:
         # If invoice is being added, check if we should auto-close
         if data["invoice_number"] != "Pendiente":
             data["invoice_date"] = datetime.now().strftime("%Y-%m-%d") # Auto set date if not present
             data["status"] = "Entregado y Facturado"
    
    # Update Firebase
    if db:
        try:
            db.collection(COLLECTION_NAME).document(req_id).update(data)
        except Exception as e:
            print(f"Error updating Firebase: {e}")

    return local_db.update_request(req_id, data)

def delete_request(req_id: str):
    # Delete from Firebase
    if db:
        try:
            db.collection(COLLECTION_NAME).document(req_id).delete()
        except Exception as e:
            print(f"Error deleting from Firebase: {e}")

    return local_db.delete_request(req_id)

def bulk_import_from_excel(file_content: bytes):
    try:
        df = pd.read_excel(file_content)
        new_columns = {}
        for col in df.columns:
            c = str(col).strip().lower()
            if "id" == c: new_columns[col] = "legacy_id"
            elif "solicitud" in c: new_columns[col] = "request_date"
            elif "recole" in c: new_columns[col] = "pickup_date"
            elif "hora" in c: new_columns[col] = "pickup_time"
            elif "estado" in c: new_columns[col] = "status"
            elif "transport" in c: new_columns[col] = "carrier"
            elif "origen" in c: new_columns[col] = "origin"
            elif "destino" in c: new_columns[col] = "destination"
            elif "merca" in c or "asegurado" in c: new_columns[col] = "merchandise_value" # Updated keyword
            elif "veh" in c: new_columns[col] = "vehicle_type"
            elif "fecha" in c and "factura" in c: new_columns[col] = "invoice_date"
            elif "factura" in c: new_columns[col] = "invoice_number"
            elif "obs" in c: new_columns[col] = "observations"
            
        normalized_df = df.rename(columns=new_columns)
        
        for _, row in normalized_df.iterrows():
             doc_data = row.to_dict()
             doc_data = {k: (v if pd.notna(v) else None) for k, v in doc_data.items()}
             doc_data["id"] = str(uuid.uuid4())
             doc_data["created_at"] = datetime.now().isoformat()
             local_db.save_request(doc_data["id"], doc_data)

        return {"processed": len(df), "status": "success"}
    except Exception as e:
        logging.error(f"Import Error: {e}")
        return {"error": str(e)}

# --- CONFIG ENDPOINTS ---
def get_transport_config():
    return local_db.get_config()

def add_carrier(carrier_data):
    config = local_db.get_config()
    if "carriers" not in config: config["carriers"] = []
    
    carrier_data["id"] = str(uuid.uuid4())
    config["carriers"].append(carrier_data)
    local_db.save_config(config)
    return carrier_data

def add_location(location_data):
    config = local_db.get_config()
    if "locations" not in config: config["locations"] = []
    
    location_data["id"] = str(uuid.uuid4())
    config["locations"].append(location_data)
    local_db.save_config(config)
    return location_data
