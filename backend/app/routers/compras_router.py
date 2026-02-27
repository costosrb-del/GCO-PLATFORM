from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services import compras_service

router = APIRouter(prefix="/api/compras", tags=["compras"])

class TerceroCreate(BaseModel):
    nombre: str
    nit: str
    correo: str
    personaContacto: str
    numeroContacto: str
    insumos: str
    insumosPrecios: Optional[List[Dict[str, Any]]] = None
    id: Optional[str] = None

class InsumoCreate(BaseModel):
    sku: str
    nombre: str
    rendimiento: str
    unidad: str
    proveedores: Optional[List[str]] = []
    precio: Optional[float] = 0.0
    id: Optional[str] = None

class OrdenCompraCreate(BaseModel):
    terceroId: str
    insumoId: Optional[str] = None
    insumo: str
    cantidad: float
    unidad: str
    tiempoEntrega: Optional[str] = ""
    precio_estimado: Optional[float] = 0.0
    estado: str = "Pendiente" # Pendiente, Recibido, Cancelado
    fechaMovimiento: Optional[str] = None
    comprobanteUrl: Optional[str] = None
    fechaSolicitada: Optional[str] = None
    numeroPedido: Optional[str] = None
    notas: Optional[str] = None
    entregasParciales: Optional[str] = None
    id: Optional[str] = None

class ProductoFabricadoCreate(BaseModel):
    nombre: str
    sku: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    insumosAsociados: Optional[List[Dict[str, Any]]] = None
    id: Optional[str] = None

@router.get("/insumos")
def get_insumos():
    try:
        data = compras_service.get_insumos()
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/insumos")
def create_insumo(insumo: InsumoCreate):
    try:
        created = compras_service.create_insumo(insumo.model_dump())
        return {"message": "Insumo creado", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/insumos/{insumo_id}")
def delete_insumo(insumo_id: str):
    try:
        compras_service.delete_insumo(insumo_id)
        return {"message": "Insumo eliminado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/terceros")
def get_terceros():
    try:
        data = compras_service.get_terceros()
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/terceros")
def create_tercero(tercero: TerceroCreate):
    try:
        created = compras_service.create_tercero(tercero.model_dump())
        return {"message": "Tercero creado", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/terceros/{tercero_id}")
def update_tercero(tercero_id: str, updates: Dict[str, Any]):
    try:
        compras_service.update_tercero(tercero_id, updates)
        return {"message": "Tercero actualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/terceros/{tercero_id}")
def delete_tercero(tercero_id: str):
    try:
        compras_service.delete_tercero(tercero_id)
        return {"message": "Tercero eliminado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/productos_fabricados")
def get_productos_fabricados():
    try:
        data = compras_service.get_productos_fabricados()
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/productos_fabricados")
def create_producto_fabricado(prod: ProductoFabricadoCreate):
    try:
        created = compras_service.create_producto_fabricado(prod.model_dump())
        return {"message": "Producto creado", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/productos_fabricados/{prod_id}")
def update_producto_fabricado(prod_id: str, updates: Dict[str, Any]):
    try:
        compras_service.update_producto_fabricado(prod_id, updates)
        return {"message": "Producto actualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/productos_fabricados/{prod_id}")
def delete_producto_fabricado(prod_id: str):
    try:
        compras_service.delete_producto_fabricado(prod_id)
        return {"message": "Producto eliminado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ordenes")
def get_ordenes():
    try:
        data = compras_service.get_ordenes_compra()
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ordenes")
def create_orden(orden: OrdenCompraCreate):
    try:
        created = compras_service.create_orden_compra(orden.model_dump())
        return {"message": "Orden creada", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/ordenes/{orden_id}")
def update_orden(orden_id: str, updates: Dict[str, Any]):
    try:
        compras_service.update_orden_compra(orden_id, updates)
        return {"message": "Orden actualizada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
