import gspread
from google.oauth2.service_account import Credentials
import os
import json
import tempfile

# Configuración de Google Sheets
SPREADSHEET_ID = "1ErpsHhGGsz8gJ9l1IixSiHDqHdk41OPJTwH8IVJ2KGk"
CREDENTIALS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "google_credentials.json")

def get_sheets_client():
    """
    Obtiene el cliente de Google Sheets usando credenciales de archivo local
    o de variable de entorno (para producción/despliegue).
    """
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
    
    # Opción 1: Variable de entorno (PARA PRODUCCIÓN EN CLOUD RUN)
    credentials_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
    
    if credentials_json:
        # Usar credenciales de variable de entorno (Cloud Run)
        print("✓ Variable GOOGLE_CREDENTIALS_JSON detectada.")
        try:
            # Limpieza robusta del string JSON (por si al copiar/pegar quedan caracteres extraños)
            clean_json = credentials_json.strip()
            # En caso de que se hayan escapado comillas extras o saltos de línea mal formados
            if clean_json.startswith("'") and clean_json.endswith("'"):
                clean_json = clean_json[1:-1]
            if clean_json.startswith('"') and clean_json.endswith('"'):
                clean_json = clean_json[1:-1]
            
            # Intentar decodificar
            credentials_info = json.loads(clean_json)
            creds = Credentials.from_service_account_info(credentials_info, scopes=scopes)
            return gspread.authorize(creds)
        except json.JSONDecodeError as e:
            print(f"❌ Error de formato JSON en GOOGLE_CREDENTIALS_JSON: {e}")
            print(f"   Primeros 20 chars: {credentials_json[:20]}...")
            # IMPORTANTE: No imprimir toda la credencial por seguridad en logs, pero sí el error
            raise ValueError(f"El JSON de credenciales está mal formado: {str(e)}")
        except Exception as e:
            print(f"❌ Error desconocido al cargar credenciales desde variable: {e}")
            raise
    
    # Opción 2: Archivo local (PARA DESARROLLO LOCAL)
    if os.path.exists(CREDENTIALS_FILE):
        print(f"✓ Usando credenciales de archivo local: {CREDENTIALS_FILE}")
        creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
        return gspread.authorize(creds)
    
    # Si no hay ninguna opción disponible
    error_msg = (
        "❌ NO SE ENCONTRARON CREDENCIALES DE GOOGLE SHEETS.\n"
        f"   - Archivo local: {CREDENTIALS_FILE} (no existe)\n"
        "   - Variable de entorno: GOOGLE_CREDENTIALS_JSON (no definida)\n"
        "   Para producción, configure GOOGLE_CREDENTIALS_JSON en Google Cloud Run.\n"
        "   Para desarrollo local, asegúrese de tener google_credentials.json en la raíz del backend."
    )
    print(error_msg)
    raise FileNotFoundError(error_msg)

def get_target_sheet(ss):
    """
    Encuentra la hoja correcta (prefiere 'Hoja 1' o la que tenga 'CUC' en A1)
    """
    try:
        # Intentar por nombre primero si es común
        return ss.worksheet("Hoja 1")
    except:
        # Si no, buscar la que tenga el encabezado CUC
        for ws in ss.worksheets():
            if ws.cell(1, 1).value == "CUC":
                return ws
        return ss.get_worksheet(0)

import time

# --- CACHE GLOBAL EN MEMORIA ---
# Estructura: {'data': [lista_clientes], 'timestamp': 1234567890}
_CLIENTS_CACHE = {
    'data': [],
    'timestamp': 0,
    'ttl': 300  # 5 minutos de vida (tiempo que tarda en detectar cambios manuales de Sheets)
}

def invalidate_cache():
    """Fuerza a recargar los datos de Sheets en la próxima consulta."""
    _CLIENTS_CACHE['timestamp'] = 0
    print("🔄 Caché invalidada: Se leerá de Google Sheets en la próxima petición.")

def add_client_to_sheet(client_data: dict):
    """
    Agrega un nuevo cliente a la hoja de cálculo.
    """
    client = get_sheets_client()
    ss = client.open_by_key(SPREADSHEET_ID)
    sheet = get_target_sheet(ss)
    
    # ... (Lógica de prefijos y cálculo de CUC se mantiene igual, abreviada aquí por simplicidad) ...
    # NOTA: Para no romper el código existente, repetimos la lógica de cálculo o asumimos que ya está.
    # Dado que replace_file es por bloques, reinsertaré la lógica completa de add_client que ya tenías,
    # pero añadiendo la gestión de caché al final.
    
    PREFIX_MAP = {
        "ARMONIA C.": "AB",
        "HECHIZO DE BELLEZA": "HB",
        "RAICES ORGANICAS": "RO",
        "RITUAL BOTANICO": "RB",
        "GRUPO HUMAN": "GH",
        "ALMAVERDE": "AV"
    }
    
    selected_company = client_data.get("empresa", "ARMONIA C.")
    prefix = PREFIX_MAP.get(selected_company, "AB")
    
    # IMPORTANTE: Usamos get_all_values directo de Sheet (no caché) para calcular CUC seguro
    all_values = sheet.get_all_values()
    
    company_cucs = []
    if len(all_values) > 1:
        for row in all_values[1:]:
            cuc = str(row[0]).strip()
            if cuc.startswith(prefix):
                try:
                    num = int(cuc[len(prefix):])
                    company_cucs.append(num)
                except ValueError:
                    continue
    
    next_num = 100
    if company_cucs:
        next_num = max(company_cucs) + 1
    
    new_cuc = f"{prefix}{next_num:08d}"
        
    new_row = [
        new_cuc,
        client_data.get("nit", ""),
        client_data.get("nombre", ""),
        client_data.get("telefono", ""),
        client_data.get("correo", ""),
        client_data.get("categoria", ""),
        selected_company.upper(),
        client_data.get("ciudad", "").upper(),
        client_data.get("departamento", "").upper()
    ]
    
    sheet.append_row(new_row)
    
    # --- ACTUALIZACIÓN INTELIGENTE DE CACHÉ ---
    # En lugar de invalidar y obligar a leer todo (lento), agregamos el nuevo cliente a la memoria
    if _CLIENTS_CACHE['data']:
        # Convertimos la lista plana a diccionario (con headers conocidos o inferidos)
        # Para ser seguros, mejor INVALIDAMOS para que la próxima lectura traiga todo limpio
        # ya que manejar los headers en memoria es riesgoso si cambian.
        invalidate_cache() 
        # Si quisiéramos "append" en memoria, necesitaríamos conocer los headers exactos aquí.
        # Invalidad es suficientemente rápido para el usuario que guarda (ya esperó el guardado).
    
    return new_cuc

def get_clients_from_sheet(limit: int = 100, offset: int = 0):
    """
    Obtiene los clientes con CACHÉ.
    """
    global _CLIENTS_CACHE
    current_time = time.time()
    
    # 1. Verificar Caché
    if _CLIENTS_CACHE['data'] and (current_time - _CLIENTS_CACHE['timestamp'] < _CLIENTS_CACHE['ttl']):
        # print("⚡ Usando Caché de Memoria") # Debug
        all_clients = _CLIENTS_CACHE['data']
    else:
        # 2. Si expiró, leer de Google
        try:
            print("🌐 Leyendo de Google Sheets (Cache Miss)...")
            client = get_sheets_client()
            ss = client.open_by_key(SPREADSHEET_ID)
            sheet = get_target_sheet(ss)
            all_values = sheet.get_all_values()
            
            if not all_values or len(all_values) <= 1:
                return []
            
            # Procesar headers
            import unicodedata
            def clean_header(h):
                h = unicodedata.normalize('NFD', str(h))
                h = "".join([c for c in h if not unicodedata.combining(c)])
                return h.lower().strip()

            headers = [clean_header(h) for h in all_values[0]]
            parsed_clients = []
            
            for row in all_values[1:]:
                padded_row = row + [""] * (len(headers) - len(row))
                client_obj = dict(zip(headers, padded_row))
                parsed_clients.append(client_obj)
            
            # Guardar en Caché
            _CLIENTS_CACHE['data'] = parsed_clients
            _CLIENTS_CACHE['timestamp'] = current_time
            all_clients = parsed_clients
            
        except (FileNotFoundError, Exception) as e:
            print(f"Error conectando a Sheets: {e}")
            return []

    # 3. Paginación sobre Memoria (Ultra rápido)
    if limit > 0:
        return all_clients[offset : offset + limit]
        
    return all_clients

def find_client_by_nit(target_nit: str):
    """
    Busca un cliente por NIT exacto en la hoja.
    Retorna el diccionario del cliente si existe, o None.
    """
    try:
        clients = get_clients_from_sheet(limit=0) # Traer todos
        target_clean = "".join([c for c in str(target_nit) if c.isdigit()])
        
        for client in clients:
            # Asumimos que la columna se llama 'nit' o similar (get_clients ya normaliza headers a lowercase)
            c_nit = str(client.get("nit", ""))
            c_nit_clean = "".join([c for c in c_nit if c.isdigit()])
            
            if c_nit_clean and c_nit_clean == target_clean:
                return client
                
        return None
    except Exception as e:
        print(f"Error buscando cliente por NIT: {e}")
        return None
