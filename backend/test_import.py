
try:
    from app.main import app
    print("Import Successful")
except Exception as e:
    print(f"Import Failed: {e}")
