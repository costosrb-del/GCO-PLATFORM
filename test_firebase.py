
import os
import firebase_admin
from firebase_admin import credentials, firestore

# Mismo path logic que transport_service.py
CRED_PATH = os.path.join(os.getcwd(), "backend", "serviceAccountKey.json")
# O si corremos desde backend root
if not os.path.exists(CRED_PATH):
    CRED_PATH = "serviceAccountKey.json"

print(f"Checking Path: {CRED_PATH}")
if os.path.exists(CRED_PATH):
    print("File Exists")
    try:
        cred = credentials.Certificate(CRED_PATH)
        print("Credential Loaded")
        if not firebase_admin._apps:
             firebase_admin.initialize_app(cred)
        print("Param App Init")
        db = firestore.client()
        print("Firestore Client Init Success")
        
        # Try read
        docs = db.collection("transport_requests").limit(1).stream()
        print("Read Success")
    except Exception as e:
        print(f"Error: {e}")
else:
    print("File NOT Found")
