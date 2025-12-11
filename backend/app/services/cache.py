import os
import json
import logging
try:
    from google.cloud import storage
except ImportError:
    storage = None

class CacheService:
    def __init__(self):
        # Default to 'local' if explicitly set, otherwise try 'cloud'
        self.mode = os.getenv("CACHE_MODE", "cloud") 
        self.bucket_name = os.getenv("CACHE_BUCKET", "gco-platform-cache-v2")
        self.local_dir = "local_cache"
        self.client = None
        self.bucket = None
        
        if self.mode == "cloud" and storage:
            try:
                self.client = storage.Client()
                # We don't create bucket here to avoid permissions issues if not admin. 
                # Assuming bucket exists or will be created manually/terraform.
                # However, for MVP, we might want to try-create?
                # Let's just wrap usage.
                self.bucket = self.client.bucket(self.bucket_name)
            except Exception as e:
                logging.warning(f"GCS Init failed (likely no creds). Falling back to local cache. Error: {e}")
                self.mode = "local"
        else:
            self.mode = "local"

        if self.mode == "local":
            if not os.path.exists(self.local_dir):
                os.makedirs(self.local_dir, exist_ok=True)
            logging.info(f"CacheService initialized in LOCAL mode ({self.local_dir})")

    def save(self, key: str, data: dict):
        try:
            json_str = json.dumps(data)
            if self.mode == "cloud":
                # Ensure bucket exists or handle 404
                if not self.bucket.exists():
                     try:
                         self.bucket.create(location="US")
                     except:
                         logging.error("Could not create bucket.")
                         return False
                
                blob = self.bucket.blob(key)
                blob.upload_from_string(json_str, content_type='application/json')
            else:
                filepath = os.path.join(self.local_dir, key)
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(json_str)
            return True
        except Exception as e:
            logging.error(f"Cache Save Error: {e}")
            return False

    def load(self, key: str):
        try:
            if self.mode == "cloud":
                if not self.bucket.exists():
                     return None
                blob = self.bucket.blob(key)
                if not blob.exists():
                    return None
                content = blob.download_as_text()
                return json.loads(content)
            else:
                filepath = os.path.join(self.local_dir, key)
                if not os.path.exists(filepath):
                    return None
                with open(filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            logging.warning(f"Cache Load Miss/Error: {e}")
            return None

cache = CacheService()
