import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import uuid
import os
import json

# --- LOCAL PROTOTYPING DB STUB ---
LOCAL_DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "local_tasks_db.json")

class LocalTasksDB:
    def __init__(self):
        self.file_path = LOCAL_DB_FILE
        if not os.path.exists(self.file_path):
            self._save([], self.file_path)

    def _load(self):
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []

    def _save(self, data):
        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, default=str)

    def get_all(self):
        data = self._load()
        if isinstance(data, list):
            data.sort(key=lambda x: x.get('created_at', '') or '', reverse=True)
        else:
            data = []
        return data

    def save(self, doc_data):
        current = self.get_all()
        doc_id = doc_data.get('id')
        existing_idx = next((i for i, d in enumerate(current) if d.get('id') == doc_id), -1)
        if existing_idx >= 0:
            current[existing_idx] = doc_data
        else:
            current.append(doc_data)
        self._save(current)
        return doc_data

    def delete(self, doc_id):
        current = self.get_all()
        new_list = [d for d in current if d.get('id') != doc_id]
        if len(new_list) < len(current):
            self._save(new_list)
            return True
        return False

local_db = LocalTasksDB()

# --- FIRESTORE INIT ---
# Check if already initialized in transport_service or main
db = None
try:
    if firebase_admin._apps:
        db = firestore.client()
    else:
        # Try to init from default path if not initialized
        CRED_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "serviceAccountKey.json")
        if os.path.exists(CRED_PATH):
            cred = credentials.Certificate(CRED_PATH)
            firebase_admin.initialize_app(cred)
            db = firestore.client()
except Exception as e:
    print(f"⚠️ Firebase Tasks Connection Failed: {e}")

COLLECTION_NAME = "tasks"

def get_all_tasks():
    if db:
        try:
            docs = db.collection(COLLECTION_NAME).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Error fetching tasks from Firebase: {e}")
            return local_db.get_all()
    return local_db.get_all()

def create_task(data: dict):
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    if "created_at" not in data or not data["created_at"]:
        data["created_at"] = datetime.now().isoformat()
    if "status" not in data:
         data["status"] = "Pendiente"
    
    if db:
        try:
            db.collection(COLLECTION_NAME).document(data["id"]).set(data)
            return data
        except Exception as e:
            print(f"Error saving task to Firebase: {e}")
            pass
            
    local_db.save(data)
    return data

def update_task(task_id: str, data: dict):
    # Retrieve current task to update fields properly locally
    existing_tasks = local_db.get_all()
    task = next((t for t in existing_tasks if t.get('id') == task_id), None)
    
    if db:
        try:
            db.collection(COLLECTION_NAME).document(task_id).update(data)
        except Exception as e:
            print(f"Error updating task Firebase: {e}")

    if task:
        task.update(data)
        return local_db.save(task)
    return None

def delete_task(task_id: str):
    if db:
        try:
            db.collection(COLLECTION_NAME).document(task_id).delete()
        except Exception as e:
            print(f"Error deleting task Firebase: {e}")

    return local_db.delete(task_id)
