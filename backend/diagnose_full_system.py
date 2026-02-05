"""
Script de diagnóstico completo - Frontend + Backend + Google Sheets
"""
import requests
import json

print("=" * 70)
print(" DIAGNÓSTICO COMPLETO - GCO PLATFORM V2")
print("=" * 70)

# 1. Verificar que el backend esté accesible
print("\n[1/5] Verificando conectividad con el backend...")
try:
    response = requests.get("http://localhost:8000/")
    if response.status_code == 200:
        print(f"✓ Backend accesible: {response.json()}")
    else:
        print(f"⚠ Backend respondió con código {response.status_code}")
except Exception as e:
    print(f"✗ ERROR: No se puede conectar al backend - {str(e)}")
    print("  → Asegúrate de que el backend esté corriendo (python run.py)")
    exit(1)

# 2. Probar Google Sheets directamente
print("\n[2/5] Verificando conexión con Google Sheets...")
try:
    from app.services.google_sheets_service import get_clients_from_sheet
    clients = get_clients_from_sheet(limit=3)
    print(f"✓ Google Sheets funciona: {len(clients)} clientes obtenidos")
except Exception as e:
    print(f"✗ ERROR en Google Sheets: {str(e)}")

# 3. Listar usuarios disponibles para autenticación
print("\n[3/5] Usuarios registrados en el sistema...")
try:
    from app.services import roles as role_service
    all_roles = role_service.get_all_roles()
    print(f"✓ Usuarios encontrados: {len(all_roles)}")
    for email, role in all_roles.items():
        print(f"   - {email} [{role}]")
except Exception as e:
    print(f"⚠ No se pudo listar usuarios: {str(e)}")

# 4. Verificar que el endpoint de clientes esté registrado
print("\n[4/5] Verificando endpoints registrados...")
try:
    from app.main import app
    client_endpoints = [route for route in app.routes if '/clients' in str(route.path)]
    print(f"✓ Endpoints de clientes encontrados: {len(client_endpoints)}")
    for route in client_endpoints:
        methods = ', '.join(route.methods) if hasattr(route, 'methods') else 'GET'
        print(f"   - {methods} {route.path}")
except Exception as e:
    print(f"⚠ No se pudo verificar endpoints: {str(e)}")

# 5. Instrucciones para el frontend
print("\n[5/5] Pasos para verificar el frontend...")
print("✓ Abre la consola del navegador (F12)")
print("✓ Ve a la pestaña 'Network' (Red)")
print("✓ Navega a la página de clientes (http://localhost:3000/dashboard/asesoras)")
print("✓ Busca las llamadas a '/api/clients' y verificar:")
print("   - Status Code (debería ser 200)")
print("   - Headers → Authorization (debe tener el token)")
print("   - Response  (debería tener datos de clientes)")

print("\n" + "=" * 70)
print(" DIAGNÓSTICO COMPLETADO")
print("=" * 70)
print("\nPRÓXIMOS PASOS:")
print("1. Si el backend NO está corriendo → ejecuta 'python run.py' en backend/")
print("2. Si el frontend NO está corriendo → ejecuta 'npm run dev' en frontend/")
print("3. Verifica que hayas iniciado sesión en el frontend")
print("4. Abre la consola del navegador y busca errores específicos")
print("=" * 70)
