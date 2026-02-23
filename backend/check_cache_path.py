
import os
from app.services.cache import cache

print(f"Cache Mode: {cache.mode}")
print(f"Cache Local Dir: {cache.local_dir}")
print(f"Absolute Path: {os.path.abspath(cache.local_dir)}")

test_file = "history_HECHIZO DE BELLEZA S.A.S..json"
exists = os.path.exists(os.path.join(cache.local_dir, test_file))
print(f"Does {test_file} exist in {cache.local_dir}? {exists}")

# Check C:\tmp\gco_local_cache
other_path = r"C:\tmp\gco_local_cache"
exists_other = os.path.exists(os.path.join(other_path, test_file))
print(f"Does {test_file} exist in {other_path}? {exists_other}")
