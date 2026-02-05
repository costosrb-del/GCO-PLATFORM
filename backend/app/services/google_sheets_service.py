import gspread
from google.oauth2.service_account import Credentials
import os

# Configuración de Google Sheets
SPREADSHEET_ID = "1ErpsHhGGsz8gJ9l1IixSiHDqHdk41OPJTwH8IVJ2KGk"
CREDENTIALS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "google_credentials.json")

def get_sheets_client():
    if not os.path.exists(CREDENTIALS_FILE):
        # Para CI/CD o entornos sin credenciales, evitamos el crash
        # Si esto se llama en producción real sin archivo, debe fallar, pero con un mensaje claro.
        print(f"ADVERTENCIA: No se encontró el archivo de credenciales en {CREDENTIALS_FILE}")
        # En test/CI podríamos retornar un Mock si fuera necesario, o simplemente dejar que falle
        # aquí abajo con un error más controlado si es requerido.
        raise FileNotFoundError(f"No se encontró el archivo de credenciales: {CREDENTIALS_FILE}")

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=scopes)
    return gspread.authorize(creds)

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

def add_client_to_sheet(client_data: dict):
    """
    Agrega un nuevo cliente a la hoja de cálculo.
    client_data debe contener: NIT, NOMBRE, TELEFONO, CORREO, CATEGORIA, EMPRESA, CIUDAD, DEPARTAMENTO
    """
    client = get_sheets_client()
    ss = client.open_by_key(SPREADSHEET_ID)
    sheet = get_target_sheet(ss)
    
    # Mapeo de prefijos unificado con la base de datos
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
    
    # Obtener todos los datos para encontrar el último CUC de ESA empresa
    all_values = sheet.get_all_values()
    
    # Filtrar solo las filas que tengan el prefijo de la empresa seleccionada
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
    
    # Calcular el siguiente número
    next_num = 100 # Valor base si no hay registros
    if company_cucs:
        next_num = max(company_cucs) + 1
    
    new_cuc = f"{prefix}{next_num:08d}"
        
    # Preparar fila
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
    return new_cuc

def get_clients_from_sheet(limit: int = 100, offset: int = 0):
    """
    Obtiene los clientes de la hoja de cálculo con paginación.
    Si limit es 0, trae todos los registros.
    """
    try:
        client = get_sheets_client()
        ss = client.open_by_key(SPREADSHEET_ID)
        sheet = get_target_sheet(ss)
        
        # Traer todo para evitar errores de rango con A1 notation y mejorar consistencia de filtrado
        all_values = sheet.get_all_values()
    except (FileNotFoundError, Exception) as e:
        print(f"Error conectando a Sheets (posiblemente entorno CI/Test sin credenciales): {e}")
        return []
    
    if limit > 0:
        # Headers + Rango de datos (saltando headers en slicing)
        headers = all_values[0]
        data = all_values[1 + offset : 1 + offset + limit]
        all_values = [headers] + data

    if not all_values or len(all_values) <= 1:
        return []
        
    # Limpieza robusta de encabezados (remover tildes y caracteres especiales)
    import unicodedata
    def clean_header(h):
        h = unicodedata.normalize('NFD', str(h))
        h = "".join([c for c in h if not unicodedata.combining(c)])
        return h.lower().strip()

    headers = [clean_header(h) for h in all_values[0]]
    clients = []
    
    for row in all_values[1:]:
        padded_row = row + [""] * (len(headers) - len(row))
        client_obj = dict(zip(headers, padded_row))
        clients.append(client_obj)
        
    return clients
