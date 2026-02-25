import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))
from app.services.transport_service import db, COLLECTION_NAME, local_db

if db:
    docs = db.collection(COLLECTION_NAME).stream()
    count = 0
    for doc in docs:
        doc.reference.delete()
        count += 1
    print(f"Deleted {count} documents from Firebase.")
else:
    print("Firebase DB not available.")

# Delete local JSON db too
if hasattr(local_db, 'file_path') and os.path.exists(local_db.file_path):
    local_db._save([], local_db.file_path)
    print("Local JSON cleared.")
