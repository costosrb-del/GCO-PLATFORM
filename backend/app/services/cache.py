import os
import json
import logging
try:
    from google.cloud import storage
except ImportError:
    storage = None

class CacheService:
    def __init__(self):
        # Default to 'cloud' for persistence. Fallback to 'local' happens in _connect if auth fails.
        self.mode = os.getenv("CACHE_MODE", "cloud") 
        self.bucket_name = os.getenv("CACHE_BUCKET", "gco-platform-cache-v2")
        # Use /tmp for local cache in production/cloud environments (ephemeral)
        self.local_dir = os.getenv("LOCAL_CACHE_DIR", "/tmp/gco_local_cache")
        self.client = None
        self.bucket = None
        
        if self.mode == "cloud" and storage:
            # Lazy initialization to prevent import blocking
            self.client = None 
            self.bucket = None
        else:
            self.mode = "local"

        if self.mode == "local":
            if not os.path.exists(self.local_dir):
                os.makedirs(self.local_dir, exist_ok=True)
            logging.info(f"CacheService initialized in LOCAL mode ({self.local_dir})")

    def _connect(self):
        if self.mode == "cloud" and not self.client:
            try:
                logging.info("Connecting to Google Cloud Storage...")
                self.client = storage.Client()
                self.bucket = self.client.bucket(self.bucket_name)
            except Exception as e:
                logging.error(f"Failed to connect to GCS: {e}. Falling back to local.")
                self.mode = "local"
                self.local_dir = os.getenv("LOCAL_CACHE_DIR", "/tmp/gco_local_cache")
                if not os.path.exists(self.local_dir):
                    os.makedirs(self.local_dir, exist_ok=True)

    def save(self, key: str, data: dict):
        try:
            self._connect()
            json_str = json.dumps(data)
            
            # Save locally first
            filepath = os.path.join(self.local_dir, key)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(json_str)

            if self.mode == "cloud":
                # Optimization: Skip .exists() check. Just upload.
                # GCS charges for every .exists() call.
                blob = self.bucket.blob(key)
                blob.upload_from_string(json_str, content_type='application/json')
            
            return True
        except Exception as e:
            logging.error(f"Cache Save Error: {e}")
            return False

    def load(self, key: str):
        try:
            # 1. Try local cache first (Short-term memory)
            filepath = os.path.join(self.local_dir, key)
            if os.path.exists(filepath):
                # Simple TTL check (1 hour)
                import time
                if (time.time() - os.path.getmtime(filepath)) < 3600:
                    with open(filepath, "r", encoding="utf-8") as f:
                        return json.load(f)

            # 2. Try Cloud cache
            self._connect()
            if self.mode == "cloud":
                blob = self.bucket.blob(key)
                # Optimization: Use try-except instead of blob.exists() to save 1 API call
                try:
                    content = blob.download_as_text()
                    # Update local cache
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(content)
                    return json.loads(content)
                except:
                    return None
            
            return None
        except Exception as e:
            logging.warning(f"Cache Load Miss/Error: {e}")
            return None

cache = CacheService()
