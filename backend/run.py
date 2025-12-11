
import uvicorn
import os
import sys

# Ensure the backend directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting GCO Platform Backend...")
    # Bind to 0.0.0.0 to maybe allow access from other devices (still blocked by browser mixed content though)
    # Reload is useful for dev
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
