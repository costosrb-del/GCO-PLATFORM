import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.google_sheets_service import get_clients_from_sheet

def test_search(query):
    try:
        # Simulate search logic in router
        clients = get_clients_from_sheet(limit=0)
        print(f"Total rows fetched: {len(clients)}")
        search = query.lower()
        filtered = []
        for c in clients:
            if (search in str(c.get("nombre", "")).lower() or 
                search in str(c.get("nit", "")).lower() or 
                search in str(c.get("cuc", "")).lower()):
                filtered.append(c)
        print(f"Matches for '{query}': {len(filtered)}")
        if filtered:
            print(f"First match: {filtered[0]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_search("1007338207")
