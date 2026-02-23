
import sys
import os
import glob
import time

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.cache import cache
except ImportError:
    # Fallback if run from root
    sys.path.append(os.getcwd())
    from backend.app.services.cache import cache

def force_reset():
    print("--- FORCING RESET OF SALES AVERAGES CACHE ---")
    
    # 1. Identify Cache Directory
    folder = cache.local_dir
    print(f"Target Cache Directory: {folder}")
    
    if not os.path.exists(folder):
        print("Cache directory does not exist. Nothing to clean.")
        return

    # 2. Delete history files (Source data for averages)
    # detecting history_*.json
    history_files = glob.glob(os.path.join(folder, "history_*.json"))
    print(f"Found {len(history_files)} history files to delete.")
    
    for f in history_files:
        try:
            os.remove(f)
            print(f"  [DELETED] {os.path.basename(f)}")
        except Exception as e:
            print(f"  [ERROR] Could not delete {f}: {e}")

    # 3. Delete Averages Result Cache
    avg_file = os.path.join(folder, "sales_averages.json")
    if os.path.exists(avg_file):
        try:
            os.remove(avg_file)
            print(f"  [DELETED] sales_averages.json")
        except Exception as e:
            print(f"  [ERROR] Could not delete averages file: {e}")
    else:
        print("  sales_averages.json not found.")
        
    print("\n--- CACHE CLEARED SUCCESSFULLY ---")
    print("Please click 'Actualizar Promedios' in the dashboard to rebuild data from scratch.")

if __name__ == "__main__":
    force_reset()
