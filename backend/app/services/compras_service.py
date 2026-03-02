import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import uuid
import os
import json

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
    print(f"⚠️ Firebase Compras Connection Failed: {e}")

COLLECTION_TERCEROS = "terceros_compras"
COLLECTION_ORDENES = "ordenes_compras"
COLLECTION_INSUMOS = "insumos_base"

def get_insumos():
    if db:
        try:
            docs = db.collection(COLLECTION_INSUMOS).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Error fetching insumos: {e}")
            return []
    return []

def create_insumo(data: dict):
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    if "created_at" not in data:
        data["created_at"] = datetime.now().isoformat()
    # Limpia valores None para evitar ruido en Firestore
    clean_data = {k: v for k, v in data.items() if v is not None}
    if db:
        try:
            db.collection(COLLECTION_INSUMOS).document(clean_data["id"]).set(clean_data)
            return clean_data
        except Exception as e:
            print(f"Error saving insumo Firebase: {e}")
            raise
    return clean_data

def update_insumo(insumo_id: str, data: dict):
    if db:
        try:
            db.collection(COLLECTION_INSUMOS).document(insumo_id).update(data)
            return True
        except Exception as e:
            print(f"Error updating insumo Firebase: {e}")
    return False

def delete_insumo(insumo_id: str):
    if db:
        try:
            db.collection(COLLECTION_INSUMOS).document(insumo_id).delete()
        except Exception as e:
            print(f"Error deleting insumo: {e}")
    return True

def get_terceros():
    if db:
        try:
            docs = db.collection(COLLECTION_TERCEROS).order_by("nombre").stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Error fetching terceros: {e}")
            return []
    return []

def create_tercero(data: dict):
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    if "created_at" not in data:
        data["created_at"] = datetime.now().isoformat()
    
    if db:
        try:
            db.collection(COLLECTION_TERCEROS).document(data["id"]).set(data)
            return data
        except Exception as e:
            print(f"Error saving tercero Firebase: {e}")
    return data

def update_tercero(tercero_id: str, data: dict):
    if db:
        try:
            db.collection(COLLECTION_TERCEROS).document(tercero_id).update(data)
            return True
        except Exception as e:
            print(f"Error updating tercero Firebase: {e}")
    return False

def delete_tercero(tercero_id: str):
    if db:
        try:
            db.collection(COLLECTION_TERCEROS).document(tercero_id).delete()
        except Exception as e:
            print(f"Error deleting tercero: {e}")
    return True

def get_ordenes_compra():
    if db:
        try:
            docs = db.collection(COLLECTION_ORDENES).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Error fetching ordenes: {e}")
            return []
    return []

def create_orden_compra(data: dict):
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    if "created_at" not in data:
        data["created_at"] = datetime.now().isoformat()
    if "estado" not in data:
        data["estado"] = "Pendiente"
    # Limpia None para no guardar keys vacías en Firestore
    clean_data = {k: v for k, v in data.items() if v is not None}
    if db:
        try:
            db.collection(COLLECTION_ORDENES).document(clean_data["id"]).set(clean_data)
            return clean_data
        except Exception as e:
            print(f"Error saving orden Firebase: {e}")
            raise
    return clean_data

def update_orden_compra(orden_id: str, data: dict):
    if db:
        try:
            db.collection(COLLECTION_ORDENES).document(orden_id).update(data)
            return True
        except Exception as e:
            print(f"Error updating orden Firebase: {e}")
    return False

def delete_orden_compra(orden_id: str):
    if db:
        try:
            db.collection(COLLECTION_ORDENES).document(orden_id).delete()
        except Exception as e:
            print(f"Error deleting orden: {e}")
    return True

COLLECTION_PRODUCTOS_FABRICADOS = "productos_fabricados"

def get_productos_fabricados():
    if db:
        try:
            docs = db.collection(COLLECTION_PRODUCTOS_FABRICADOS).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Error fetching productos fabricados: {e}")
            return []
    return []

def create_producto_fabricado(data: dict):
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    if "created_at" not in data:
        data["created_at"] = datetime.now().isoformat()
    
    if db:
        try:
            db.collection(COLLECTION_PRODUCTOS_FABRICADOS).document(data["id"]).set(data)
            return data
        except Exception as e:
            print(f"Error saving producto fabricado Firebase: {e}")
    return data

def update_producto_fabricado(prod_id: str, data: dict):
    if db:
        try:
            db.collection(COLLECTION_PRODUCTOS_FABRICADOS).document(prod_id).update(data)
            return True
        except Exception as e:
            print(f"Error updating producto fabricado Firebase: {e}")
    return False

def delete_producto_fabricado(prod_id: str):
    if db:
        try:
            db.collection(COLLECTION_PRODUCTOS_FABRICADOS).document(prod_id).delete()
        except Exception as e:
            print(f"Error deleting producto fabricado: {e}")
    return True
