
import requests
import json

def test():
    try:
        # We need a token. Let's try to bypass or use a mock if the developer left one, 
        # but since we can't easily, let's just create a debug endpoint or call the func directly.
        pass
    except Exception as e:
        print(e)

if __name__ == "__main__":
    from app.services.analytics import calculate_average_sales
    from datetime import datetime
    
    start = datetime.now()
    avg, trends, audit = calculate_average_sales(days=16, split_by_company=True)
    end = datetime.now()
    
    print(f"Time taken: {end - start}")
    print(f"Audit: {json.dumps(audit, indent=2)}")
    
    target = "7702"
    for comp, skus in avg.items():
        if target in skus:
            print(f"Company {comp} - {target}: {skus[target]}")
