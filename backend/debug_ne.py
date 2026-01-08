
import requests
import json
from app.services.config import get_config
from app.services.auth import get_auth_token
from app.services.movements import get_documents

def debug_find_ne():
    companies = get_config()
    target_company = companies[0]
    
    print(f"Buscando 'NE' (Notas de Ensamble) en: {target_company['name']}")
    
    token = get_auth_token(target_company["username"], target_company["access_key"])
    if not token:
        print("Auth failed")
        return

    start_date = "2025-12-01" 
    end_date = "2026-01-08"

    # Siigo no tiene un endpoint "assemblies" o "ne".
    # Lo mas probable es que sean "documents" genericos o "journals" con un tipo especifico.
    # Vamos a buscar en Journals y ver el "document_type"
    
    endpoint = "journals" 
    print(f"\nScanning {endpoint}...")
    
    # Send date_start
    data = get_documents(token, endpoint, start_date, end_date, page=1, page_size=100, date_param_name="created_start")
    
    if data and "results" in data:
        results = data["results"]
        print(f"Total Journals fetched: {len(results)}")
        
        found_ne = False
        for r in results:
             # Inspect the Document Code Prefix
             doc_name = r.get("name") # e.g. "CC-1-123" or "NE-2-55"
             doc_id = r.get("id")
             
             # Try to find a raw NE prefix
             if doc_name and ("NE" in doc_name or "ne" in doc_name.lower()):
                 print("\n!!! ENCONTRADO DOCUMENTO 'NE' !!!")
                 print(json.dumps(r, indent=2))
                 found_ne = True
                 break
        
        if not found_ne:
            print("No se encontraron documentos con 'NE' en el nombre dentro de los 'journals'.")
            
            # Intento 2: Buscar si hay algun otro tipo de documento o endpoint.
            # A veces Siigo usa 'invoices' para todo.
            print("Escaneando Facturas/Invoices por si acaso...")
            data_inv = get_documents(token, "invoices", start_date, end_date, page=1, page_size=20)
            if data_inv and "results" in data_inv:
                for r in data_inv["results"]:
                     doc_name = r.get("name")
                     if doc_name and "NE" in doc_name:
                         print("\n!!! ENCONTRADO 'NE' EN FACTURAS !!!")
                         print(json.dumps(r, indent=2))
                         found_ne = True
                         break
                         
        if not found_ne:
             print("\nDiagnostico: No veo documentos que empiecen con NE en este rango de fechas.")
             print("Posibilidad: 'NE' es un 'Tipo de Comprobante' dentro de Siigo, pero la API lo devuelve como 'CC' (Comprobante Contable) generico.")
             print("Necesito saber si el usuario ve 'NE-123' en Siigo Nube.")

if __name__ == "__main__":
    debug_find_ne()
