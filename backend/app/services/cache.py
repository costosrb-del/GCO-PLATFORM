import os
import json
import logging
import gzip
import io
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
                if not os.path.exists(self.local_dir):
                    os.makedirs(self.local_dir, exist_ok=True)

    def save(self, key: str, data: dict):
        try:
            self._connect()
            json_str = json.dumps(data)
            
            # Save locally first (Always uncompressed for speed)
            filepath = os.path.join(self.local_dir, key)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(json_str)

            if self.mode == "cloud":
                # COMPRESSION: Gzip the JSON string
                out = io.BytesIO()
                with gzip.GzipFile(fileobj=out, mode='w') as f:
                    f.write(json_str.encode('utf-8'))
                compressed_data = out.getvalue()

                blob = self.bucket.blob(key)
                blob.content_encoding = 'gzip'
                blob.upload_from_string(compressed_data, content_type='application/json')
                logging.info(f"Cache Saved to Cloud (Compressed): {key} - {len(compressed_data)} bytes")
            
            return True
        except Exception as e:
            logging.error(f"Cache Save Error: {e}")
            return False

    def load(self, key: str):
        try:
            # 1. Try local cache first (Short-term memory)
            filepath = os.path.join(self.local_dir, key)
            if os.path.exists(filepath):
                import time
                # TTL 1 hour for local cache
                if (time.time() - os.path.getmtime(filepath)) < 3600:
                    with open(filepath, "r", encoding="utf-8") as f:
                        return json.load(f)

            # 2. Try Cloud cache
            self._connect()
            if self.mode == "cloud":
                blob = self.bucket.blob(key)
                try:
                    # GCS will auto-decompress if we use download_as_text() AND content-encoding was set,
                    # but being explicit is safer for cost control.
                    compressed_content = blob.download_as_bytes()
                    
                    # Decompress
                    try:
                        with gzip.GzipFile(fileobj=io.BytesIO(compressed_content), mode='r') as f:
                            content = f.read().decode('utf-8')
                    except:
                        # Fallback if file was NOT compressed (legacy files)
                        content = compressed_content.decode('utf-8')

                    # Update local cache
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(content)
                    return json.loads(content)
                except Exception as e:
                    logging.debug(f"Cloud miss for {key}: {e}")
                    return None
            
            return None
        except Exception as e:
            logging.warning(f"Cache Load Miss/Error: {e}")
            return None

cache = CacheService()
