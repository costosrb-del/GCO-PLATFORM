"""
Test directo del endpoint de clientes
"""
import requests
import json

BASE_URL = "http://localhost:8000"

print("=" * 60)
print("TEST DE ENDPOINTS DE CLIENTES")
print("=" * 60)

# Primero necesitamos un token válido
print("\n1. Intentando login para obtener token...")
login_data = {
    "email": "admin@gcoplataforma.com",
    "password": "admin123"
}

try:
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    print(f"Status: {login_response.status_code}")
    
    if login_response.status_code == 200:
        login_result = login_response.json()
        token = login_result.get("token")
        print(f"✓ Login exitoso! Token obtenido.")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 1: Stats
        print("\n2. Probando /api/clients/stats...")
        stats_response = requests.get(f"{BASE_URL}/api/clients/stats", headers=headers)
        print(f"Status: {stats_response.status_code}")
        if stats_response.status_code == 200:
            stats = stats_response.json()
            print(f"✓ Stats obtenidas: {len(stats)} departamentos")
            for dept, count in list(stats.items())[:5]:
                print(f"   - {dept}: {count} clientes")
        else:
            print(f"✗ Error: {stats_response.text}")
        
        # Test 2: Get clients (primeros 5)
        print("\n3. Probando /api/clients (limit=5)...")
        clients_response = requests.get(f"{BASE_URL}/api/clients?limit=5&offset=0", headers=headers)
        print(f"Status: {clients_response.status_code}")
        if clients_response.status_code == 200:
            clients = clients_response.json()
            print(f"✓ Clientes obtenidos: {len(clients)}")
            if clients:
                first_client = clients[0]
                print("\n   Primer cliente:")
                for key, value in first_client.items():
                    print(f"   - {key}: {value}")
        else:
            print(f"✗ Error: {clients_response.text}")
        
        # Test 3: Search
        print("\n4. Probando búsqueda (search=BOGOTA)...")
        search_response = requests.get(f"{BASE_URL}/api/clients?search=BOGOTA&limit=3", headers=headers)
        print(f"Status: {search_response.status_code}")
        if search_response.status_code == 200:
            results = search_response.json()
            print(f"✓ Resultados de búsqueda: {len(results)}")
        else:
            print(f"✗ Error: {search_response.text}")
        
        print("\n" + "=" * 60)
        print("✓ TODAS LAS PRUEBAS COMPLETADAS")
        print("=" * 60)
        
    else:
        print(f"✗ Login falló: {login_response.text}")
        print("\nIntentando sin autenticación (debería fallar con 401)...")
        
        # Test sin auth
        print("\n2. Probando /api/clients/stats SIN token...")
        no_auth_response = requests.get(f"{BASE_URL}/api/clients/stats")
        print(f"Status: {no_auth_response.status_code}")
        print(f"Response: {no_auth_response.text}")

except Exception as e:
    print(f"\n✗ ERROR: {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
