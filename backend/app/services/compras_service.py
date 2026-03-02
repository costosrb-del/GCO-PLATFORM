import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import uuid
import os
import json
from app.services.mem_cache import mem_cache, TTL_STATIC, TTL_ORDENES, TTL_BORRADORES

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
    def _load():
        if db:
            try:
                docs = db.collection(COLLECTION_INSUMOS).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
                return [doc.to_dict() for doc in docs]
            except Exception as e:
                print(f"Error fetching insumos: {e}")
                return []
        return []
    return mem_cache.get_or_set("insumos:all", _load, TTL_STATIC)

def create_insumo(data: dict):
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    if "created_at" not in data:
        data["created_at"] = datetime.now().isoformat()
    clean_data = {k: v for k, v in data.items() if v is not None}
    if db:
        try:
            db.collection(COLLECTION_INSUMOS).document(clean_data["id"]).set(clean_data)
            mem_cache.delete("insumos:all")   # invalidar
            return clean_data
        except Exception as e:
            print(f"Error saving insumo Firebase: {e}")
            raise
    return clean_data

def update_insumo(insumo_id: str, data: dict):
    if db:
        try:
            db.collection(COLLECTION_INSUMOS).document(insumo_id).update(data)
            mem_cache.delete("insumos:all")   # invalidar
            return True
        except Exception as e:
            print(f"Error updating insumo Firebase: {e}")
    return False

def delete_insumo(insumo_id: str):
    if db:
        try:
            db.collection(COLLECTION_INSUMOS).document(insumo_id).delete()
            mem_cache.delete("insumos:all")   # invalidar
        except Exception as e:
            print(f"Error deleting insumo: {e}")
    return True

def get_terceros():
    def _load():
        if db:
            try:
                docs = db.collection(COLLECTION_TERCEROS).order_by("nombre").stream()
                return [doc.to_dict() for doc in docs]
            except Exception as e:
                print(f"Error fetching terceros: {e}")
                return []
        return []
    return mem_cache.get_or_set("terceros:all", _load, TTL_STATIC)

def create_tercero(data: dict):
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    if "created_at" not in data:
        data["created_at"] = datetime.now().isoformat()
    if db:
        try:
            db.collection(COLLECTION_TERCEROS).document(data["id"]).set(data)
            mem_cache.delete("terceros:all")  # invalidar
            return data
        except Exception as e:
            print(f"Error saving tercero Firebase: {e}")
    return data

def update_tercero(tercero_id: str, data: dict):
    if db:
        try:
            db.collection(COLLECTION_TERCEROS).document(tercero_id).update(data)
            mem_cache.delete("terceros:all")  # invalidar
            return True
        except Exception as e:
            print(f"Error updating tercero Firebase: {e}")
    return False

def delete_tercero(tercero_id: str):
    if db:
        try:
            db.collection(COLLECTION_TERCEROS).document(tercero_id).delete()
            mem_cache.delete("terceros:all")  # invalidar
        except Exception as e:
            print(f"Error deleting tercero: {e}")
    return True

def get_ordenes_compra():
    def _load():
        if db:
            try:
                docs = db.collection(COLLECTION_ORDENES).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
                return [doc.to_dict() for doc in docs]
            except Exception as e:
                print(f"Error fetching ordenes: {e}")
                return []
        return []
    return mem_cache.get_or_set("ordenes:all", _load, TTL_ORDENES)

def create_orden_compra(data: dict):
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    if "created_at" not in data:
        data["created_at"] = datetime.now().isoformat()
    if "estado" not in data:
        data["estado"] = "Pendiente"
    clean_data = {k: v for k, v in data.items() if v is not None}
    if db:
        try:
            db.collection(COLLECTION_ORDENES).document(clean_data["id"]).set(clean_data)
            mem_cache.delete("ordenes:all")   # invalidar
            return clean_data
        except Exception as e:
            print(f"Error saving orden Firebase: {e}")
            raise
    return clean_data

def update_orden_compra(orden_id: str, data: dict):
    if db:
        try:
            db.collection(COLLECTION_ORDENES).document(orden_id).update(data)
            mem_cache.delete("ordenes:all")   # invalidar
            return True
        except Exception as e:
            print(f"Error updating orden Firebase: {e}")
    return False

def delete_orden_compra(orden_id: str):
    if db:
        try:
            db.collection(COLLECTION_ORDENES).document(orden_id).delete()
            mem_cache.delete("ordenes:all")   # invalidar
        except Exception as e:
            print(f"Error deleting orden: {e}")
    return True

COLLECTION_PRODUCTOS_FABRICADOS = "productos_fabricados"

def get_productos_fabricados():
    def _load():
        if db:
            try:
                docs = db.collection(COLLECTION_PRODUCTOS_FABRICADOS).stream()
                return [doc.to_dict() for doc in docs]
            except Exception as e:
                print(f"Error fetching productos fabricados: {e}")
                return []
        return []
    return mem_cache.get_or_set("productos:all", _load, TTL_STATIC)

def create_producto_fabricado(data: dict):
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    if "created_at" not in data:
        data["created_at"] = datetime.now().isoformat()
    if db:
        try:
            db.collection(COLLECTION_PRODUCTOS_FABRICADOS).document(data["id"]).set(data)
            mem_cache.delete("productos:all")  # invalidar
            return data
        except Exception as e:
            print(f"Error saving producto fabricado Firebase: {e}")
    return data

def update_producto_fabricado(prod_id: str, data: dict):
    if db:
        try:
            db.collection(COLLECTION_PRODUCTOS_FABRICADOS).document(prod_id).update(data)
            mem_cache.delete("productos:all")  # invalidar
            return True
        except Exception as e:
            print(f"Error updating producto fabricado Firebase: {e}")
    return False

def delete_producto_fabricado(prod_id: str):
    if db:
        try:
            db.collection(COLLECTION_PRODUCTOS_FABRICADOS).document(prod_id).delete()
            mem_cache.delete("productos:all")  # invalidar
        except Exception as e:
            print(f"Error deleting producto fabricado: {e}")
    return True


# ── BORRADORES MRP (Planificaciones guardadas) ────────────────────────────────
COLLECTION_BORRADORES = "mrp_borradores"

def get_borradores():
    """Retorna todos los borradores MRP guardados, ordenados por fecha."""
    if db:
        try:
            docs = db.collection(COLLECTION_BORRADORES)\
                .order_by("updated_at", direction=firestore.Query.DESCENDING)\
                .stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Error fetching borradores MRP: {e}")
            return []
    return []

def create_borrador(data: dict):
    """Guarda un nuevo borrador MRP en Firestore."""
    if "id" not in data or not data["id"]:
        data["id"] = str(uuid.uuid4())
    now = datetime.now().isoformat()
    data["created_at"] = data.get("created_at", now)
    data["updated_at"] = now
    clean = {k: v for k, v in data.items() if v is not None}
    if db:
        try:
            db.collection(COLLECTION_BORRADORES).document(clean["id"]).set(clean)
            return clean
        except Exception as e:
            print(f"Error saving borrador MRP: {e}")
            raise
    return clean

def update_borrador(borrador_id: str, data: dict):
    """Actualiza un borrador MRP existente."""
    data["updated_at"] = datetime.now().isoformat()
    if db:
        try:
            db.collection(COLLECTION_BORRADORES).document(borrador_id).update(data)
            return True
        except Exception as e:
            print(f"Error updating borrador MRP: {e}")
    return False

def delete_borrador(borrador_id: str):
    """Elimina un borrador MRP de Firestore."""
    if db:
        try:
            db.collection(COLLECTION_BORRADORES).document(borrador_id).delete()
        except Exception as e:
            print(f"Error deleting borrador MRP: {e}")
    return True
