from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from app.services.google_sheets_service import add_client_to_sheet, get_clients_from_sheet
from app.routers.auth_router import verify_token

router = APIRouter(prefix="/api/clients", tags=["Clients"])

class ClientCreate(BaseModel):
    nit: str
    nombre: str
    telefono: str
    correo: EmailStr
    categoria: str
    empresa: str
    ciudad: str
    departamento: str

@router.get("/stats")
async def get_client_stats(user: dict = Depends(verify_token)):
    if user["role"] not in ["admin", "asesora", "viewer"]:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver estadísticas")
        
    try:
        import unicodedata
        def normalize_name(name):
            if not name: return "DESCONOCIDO"
            # Normalize to NFD and remove non-spacing marks
            name = unicodedata.normalize('NFD', str(name))
            name = "".join([c for c in name if not unicodedata.combining(c)])
            name = name.strip().upper()
            
            # Estándar para Bogotá
            if "BOGOTA" in name or name == "D.C." or name == "D.C": 
                return "BOGOTA D.C."
            # Estándar para San Andrés
            if "SAN ANDRES" in name or "PROVIDENCIA" in name: 
                return "SAN ANDRES Y PROVIDENCIA"
            # Estándar para Cundinamarca
            if "CUNDINA" in name or name == "CUNDI" or "CUND" in name:
                return "CUNDINAMARCA"
            
            return name

        clients = get_clients_from_sheet(limit=0)
        stats = {}
        for c in clients:
            dept = normalize_name(c.get("departamento"))
            stats[dept] = stats.get(dept, 0) + 1
        return stats
    except Exception as e:
        print(f"Error calculando estadísticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def list_clients(
    limit: int = 100, 
    offset: int = 0, 
    search: str = None,
    empresa: str = None,
    categoria: str = None,
    ciudad: str = None,
    departamento: str = None,
    user: dict = Depends(verify_token)
):
    # Permisos
    if user["role"] not in ["admin", "asesora", "viewer"]:
        raise HTTPException(status_code=403, detail="No tiene permisos para ver clientes")
        
    try:
        # Detectar si hay algún filtro activo
        has_filters = any([search, empresa, categoria, ciudad, departamento])
        
        # Si hay filtros, traemos TODO (limit=0) para filtrar en memoria Python
        # Si NO hay filtros, usamos la paginación nativa eficiente (traer solo la página)
        target_limit = 0 if has_filters else limit
        
        clients = get_clients_from_sheet(limit=target_limit, offset=offset)
        
        if has_filters:
            filtered = []
            
            # Normalizar términos de búsqueda
            search_clean = "".join([c for c in search if c.isdigit()]) if search else ""
            search_lower = search.lower() if search else ""
            empresa_upper = empresa.upper() if empresa else ""
            
            for c in clients:
                # 1. Filtro de Texto (Search)
                if search:
                    nit = str(c.get("nit", "")).strip()
                    nit_clean = "".join([x for x in nit if x.isdigit()])
                    nombre = str(c.get("nombre", "")).lower()
                    cuc = str(c.get("cuc", "")).lower()
                    
                    match_search = False
                    if search_clean and search_clean in nit_clean:
                        match_search = True
                    elif (search_lower in nombre or search_lower in nit.lower() or search_lower in cuc):
                        match_search = True
                    
                    if not match_search:
                        continue

                # 2. Filtro Empresa
                if empresa:
                    c_empresa = str(c.get("empresa", "")).upper()
                    if c_empresa != empresa_upper and empresa_upper not in c_empresa:
                        continue

                # 3. Filtro Categoria
                if categoria:
                    if str(c.get("categoria", "")) != categoria:
                        continue

                # 4. Filtro Ciudad
                if ciudad:
                    if ciudad.lower() not in str(c.get("ciudad", "")).lower():
                        continue

                # 5. Filtro Departamento
                if departamento:
                    if departamento.lower() not in str(c.get("departamento", "")).lower():
                        continue
                
                filtered.append(c)
            
            # Re-aplicar paginación sobre los resultados ya filtrados
            start = offset # Si filtramos, el offset aplica sobre la lista filtrada? 
            # OJO: Si el frontend manda offset=100 asumiendo paginación global, aquí puede ser confuso.
            # Pero generalmente cuando se busca/filtra se resetea a pagina 0.
            # Mantendremos la lógica: slice simple.
            
            # IMPORTANTE: Si estamos filtrando memoria, el 'offset' original de get_clients_from_sheet
            # ya se usó (con 0). Así que 'clients' tiene TODO.
            # Ahora debemos cortar 'filtered' según lo que pidió el front (limit/offset)
            
            start = min(offset, len(filtered))
            end = min(offset + limit, len(filtered))
            return filtered[start : end]
            
        return clients
    except Exception as e:
        print(f"Error listando clientes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def register_client(client: ClientCreate, user: dict = Depends(verify_token)):
    # Check role
    if user["role"] not in ["admin", "asesora"]:
        raise HTTPException(status_code=403, detail="No tiene permisos para registrar clientes")
        
    try:
        new_cuc = add_client_to_sheet(client.dict())
        return {"status": "success", "cuc": new_cuc, "message": "Cliente registrado correctamente"}
    except Exception as e:
        print(f"Error registrando cliente: {e}")
        raise HTTPException(status_code=500, detail=str(e))
