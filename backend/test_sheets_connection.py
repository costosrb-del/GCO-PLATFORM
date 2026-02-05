"""
Script de diagnóstico para verificar la conexión con Google Sheets
"""
import sys
import traceback

print("=" * 60)
print("DIAGNÓSTICO DE CONEXIÓN A GOOGLE SHEETS")
print("=" * 60)

try:
    print("\n1. Importando módulos...")
    from app.services.google_sheets_service import get_clients_from_sheet, get_sheets_client, SPREADSHEET_ID
    print("✓ Módulos importados correctamente")
    
    print("\n2. Verificando credenciales...")
    import os
    from pathlib import Path
    creds_path = Path(__file__).parent / "google_credentials.json"
    if creds_path.exists():
        print(f"✓ Archivo de credenciales encontrado: {creds_path}")
    else:
        print(f"✗ ERROR: No se encontró el archivo de credenciales en {creds_path}")
        sys.exit(1)
    
    print(f"\n3. Conectando a Google Sheets (ID: {SPREADSHEET_ID})...")
    client = get_sheets_client()
    print("✓ Cliente de Google Sheets creado correctamente")
    
    print("\n4. Abriendo hoja de cálculo...")
    ss = client.open_by_key(SPREADSHEET_ID)
    print(f"✓ Hoja de cálculo abierta: {ss.title}")
    
    print("\n5. Obteniendo lista de worksheets...")
    worksheets = ss.worksheets()
    print(f"✓ Worksheets encontradas: {len(worksheets)}")
    for i, ws in enumerate(worksheets):
        print(f"   [{i}] {ws.title} - {ws.row_count} filas x {ws.col_count} columnas")
    
    print("\n6. Probando función get_clients_from_sheet (primeros 5)...")
    clients = get_clients_from_sheet(limit=5)
    print(f"✓ Se obtuvieron {len(clients)} clientes")
    
    if clients:
        print("\n7. Ejemplo de cliente (primer registro):")
        first_client = clients[0]
        for key, value in first_client.items():
            print(f"   {key}: {value}")
    
    print("\n" + "=" * 60)
    print("✓ TODAS LAS PRUEBAS EXITOSAS")
    print("=" * 60)
    
except Exception as e:
    print("\n" + "=" * 60)
    print("✗ ERROR DETECTADO")
    print("=" * 60)
    print(f"\nTipo de error: {type(e).__name__}")
    print(f"Mensaje: {str(e)}")
    print("\nStack trace completo:")
    traceback.print_exc()
    print("=" * 60)
    sys.exit(1)
