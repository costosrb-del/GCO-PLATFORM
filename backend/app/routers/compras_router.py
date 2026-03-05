from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services import compras_service
from app.services import email_service
from app.services import roles as role_service
import os

router = APIRouter(prefix="/api/compras", tags=["compras"])


def _get_admin_emails() -> list[str]:
    """Obtiene los emails de todos los usuarios con rol admin."""
    all_roles = role_service.get_all_roles()
    admins = [email for email, role in all_roles.items() if role == "admin"]
    if not admins:
        env = os.getenv("MAIL_RECIPIENTS", "")
        admins = [e.strip() for e in env.split(",") if e.strip()]
    return admins


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
    clasificacion: Optional[str] = None
    loteMinimo: Optional[float] = 0.0
    id: Optional[str] = None


class OrdenCompraCreate(BaseModel):
    terceroId: str
    insumoId: Optional[str] = None
    insumo: str
    cantidad: float = 0
    unidad: str
    tiempoEntrega: Optional[str] = ""
    precio_estimado: Optional[float] = 0.0
    # Estados: Borrador | Pendiente | Aprobada | Cancelada | Parcial | Recibido
    estado: str = "Pendiente"
    fechaMovimiento: Optional[str] = None
    comprobanteUrl: Optional[str] = None
    fechaSolicitada: Optional[str] = None
    numeroPedido: Optional[str] = None
    notas: Optional[str] = None
    entregasParciales: Optional[str] = None
    items: Optional[List[Dict[str, Any]]] = None
    historialEntregas: Optional[List[Dict[str, Any]]] = None
    total_bruto: Optional[float] = None
    id: Optional[str] = None
    # Campos de aprobación
    aprobadoPor: Optional[str] = None
    fechaAprobacion: Optional[str] = None
    motivoRechazo: Optional[str] = None


class ProductoFabricadoCreate(BaseModel):
    nombre: str
    sku: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    insumosAsociados: Optional[List[Dict[str, Any]]] = None
    id: Optional[str] = None


class AprobacionRequest(BaseModel):
    aprobadoPor: str


class RechazoRequest(BaseModel):
    motivo: str
    rechazadoPor: Optional[str] = None


# ── INSUMOS ───────────────────────────────────────────────────────────────────

@router.get("/insumos")
def get_insumos():
    try:
        return {"data": compras_service.get_insumos()}
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


@router.put("/insumos/{insumo_id}")
def update_insumo(insumo_id: str, updates: Dict[str, Any]):
    try:
        compras_service.update_insumo(insumo_id, updates)
        return {"message": "Insumo actualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── TERCEROS ──────────────────────────────────────────────────────────────────

@router.get("/terceros")
def get_terceros():
    try:
        return {"data": compras_service.get_terceros()}
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


# ── PRODUCTOS FABRICADOS ──────────────────────────────────────────────────────

@router.get("/productos_fabricados")
def get_productos_fabricados():
    try:
        return {"data": compras_service.get_productos_fabricados()}
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


# ── ÓRDENES DE COMPRA ─────────────────────────────────────────────────────────

@router.get("/ordenes")
def get_ordenes():
    try:
        return {"data": compras_service.get_ordenes_compra()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ordenes")
def create_orden(orden: OrdenCompraCreate, background_tasks: BackgroundTasks):
    try:
        created = compras_service.create_orden_compra(orden.model_dump())

        # ── Notificación automática a admins cuando se crea una OC ────────────
        def send_notification():
            try:
                admin_emails = _get_admin_emails()
                if admin_emails:
                    # Buscar nombre del proveedor
                    terceros = compras_service.get_terceros()
                    tercero = next((t for t in terceros if t["id"] == created.get("terceroId")), None)
                    tercero_nombre = tercero["nombre"] if tercero else "Proveedor Desconocido"
                    email_service.notify_orden_creada(created, tercero_nombre, admin_emails)
            except Exception as e:
                print(f"[Email] Error enviando notificación orden creada: {e}")

        background_tasks.add_task(send_notification)
        return {"message": "Orden creada", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/ordenes/{orden_id}")
def update_orden(orden_id: str, updates: Dict[str, Any], background_tasks: BackgroundTasks):
    try:
        compras_service.update_orden_compra(orden_id, updates)

        # ── Notificar si hay cambio de estado relevante ────────────────────────
        nuevo_estado = updates.get("estado")
        if nuevo_estado in ("Aprobada", "Cancelada", "Parcial"):
            def send_state_notification():
                try:
                    # Obtener la orden actualizada
                    ordenes = compras_service.get_ordenes_compra()
                    orden = next((o for o in ordenes if o["id"] == orden_id), None)
                    if not orden:
                        return

                    terceros = compras_service.get_terceros()
                    tercero = next((t for t in terceros if t["id"] == orden.get("terceroId")), None)
                    if not tercero:
                        return

                    admin_emails = _get_admin_emails()

                    if nuevo_estado == "Aprobada":
                        # Notificar al proveedor
                        email_service.notify_orden_aprobada(orden, tercero["correo"], tercero["nombre"])

                    elif nuevo_estado == "Cancelada":
                        # Notificar internamente (admins)
                        email_service.notify_orden_rechazada(orden, tercero["nombre"], admin_emails[0] if admin_emails else "")

                    elif nuevo_estado == "Parcial":
                        # Notificar recepción parcial a admins
                        historico = orden.get("historialEntregas") or []
                        if historico:
                            last_delivery = historico[-1]
                            email_service.notify_recepcion_parcial(orden, last_delivery, tercero["nombre"], admin_emails)

                except Exception as e:
                    print(f"[Email] Error enviando notificación estado: {e}")

            background_tasks.add_task(send_state_notification)

        return {"message": "Orden actualizada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/ordenes/{orden_id}")
def delete_orden(orden_id: str):
    try:
        compras_service.delete_orden_compra(orden_id)
        return {"message": "Orden eliminada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── ENDPOINTS DEL FLUJO DE APROBACIÓN ────────────────────────────────────────

@router.post("/ordenes/{orden_id}/aprobar")
def aprobar_orden(orden_id: str, req: AprobacionRequest, background_tasks: BackgroundTasks):
    """Aprueba una OC y notifica al proveedor por email."""
    try:
        from datetime import datetime
        updates = {
            "estado": "Aprobada",
            "aprobadoPor": req.aprobadoPor,
            "fechaAprobacion": datetime.now().isoformat()
        }
        compras_service.update_orden_compra(orden_id, updates)

        def send_approval():
            try:
                ordenes = compras_service.get_ordenes_compra()
                orden = next((o for o in ordenes if o["id"] == orden_id), None)
                if not orden:
                    return
                terceros = compras_service.get_terceros()
                tercero = next((t for t in terceros if t["id"] == orden.get("terceroId")), None)
                if tercero:
                    email_service.notify_orden_aprobada(orden, tercero["correo"], tercero["nombre"])
            except Exception as e:
                print(f"[Email] Error aprobación: {e}")

        background_tasks.add_task(send_approval)
        return {"message": "Orden aprobada", "estado": "Aprobada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ordenes/{orden_id}/rechazar")
def rechazar_orden(orden_id: str, req: RechazoRequest, background_tasks: BackgroundTasks):
    """Cancela/rechaza una OC con motivo."""
    try:
        updates = {
            "estado": "Cancelada",
            "motivoRechazo": req.motivo
        }
        compras_service.update_orden_compra(orden_id, updates)

        def send_rejection():
            try:
                ordenes = compras_service.get_ordenes_compra()
                orden = next((o for o in ordenes if o["id"] == orden_id), None)
                if not orden:
                    return
                terceros = compras_service.get_terceros()
                tercero = next((t for t in terceros if t["id"] == orden.get("terceroId")), None)
                tercero_nombre = tercero["nombre"] if tercero else "Desconocido"
                admin_emails = _get_admin_emails()
                if admin_emails:
                    email_service.notify_orden_rechazada(orden, tercero_nombre, admin_emails[0])
            except Exception as e:
                print(f"[Email] Error rechazo: {e}")

        background_tasks.add_task(send_rejection)
        return {"message": "Orden cancelada", "estado": "Cancelada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── KPIs de COMPRAS (para el Dashboard) ──────────────────────────────────────

@router.get("/kpis")
def get_kpis_compras():
    """Devuelve métricas agregadas del módulo de compras para el dashboard."""
    try:
        ordenes = compras_service.get_ordenes_compra()
        terceros = compras_service.get_terceros()

        total_ordenes = len(ordenes)
        pendientes = [o for o in ordenes if o.get("estado") == "Pendiente"]
        aprobadas = [o for o in ordenes if o.get("estado") == "Aprobada"]
        recibidas = [o for o in ordenes if o.get("estado") == "Recibido"]
        parciales = [o for o in ordenes if o.get("estado") == "Parcial"]

        inversion_total = sum(
            o.get("total_bruto") or (o.get("cantidad", 0) * (o.get("precio_estimado") or 0))
            for o in ordenes
        )
        inversion_pendiente = sum(
            o.get("total_bruto") or (o.get("cantidad", 0) * (o.get("precio_estimado") or 0))
            for o in pendientes + aprobadas
        )

        return {
            "total_ordenes": total_ordenes,
            "pendientes": len(pendientes),
            "aprobadas": len(aprobadas),
            "recibidas": len(recibidas),
            "parciales": len(parciales),
            "total_proveedores": len(terceros),
            "inversion_total": round(inversion_total, 2),
            "inversion_pendiente": round(inversion_pendiente, 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── MRP: Snapshot de OC en curso por insumo ──────────────────────────────────

@router.get("/mrp/oc-snapshot")
def get_mrp_oc_snapshot():
    """
    Devuelve la cantidad total en tránsito (Pendiente + Aprobada + Parcial)
    por insumoId. El frontend lo usa para descontar del cálculo MRP.
    """
    try:
        ordenes = compras_service.get_ordenes_compra()
        # Solo órdenes activas (no recibidas ni canceladas)
        activas = [o for o in ordenes if o.get("estado") in ("Pendiente", "Aprobada", "Parcial")]

        snapshot: dict[str, float] = {}

        for oc in activas:
            items = oc.get("items") or []
            if items:
                for it in items:
                    insumo_id = it.get("insumoId", "")
                    cant = float(it.get("cantidad", 0))
                    # Descontar lo ya recibido parcialmente
                    recibida = float(it.get("cantidad_recibida", 0))
                    pendiente = max(0, cant - recibida)
                    snapshot[insumo_id] = snapshot.get(insumo_id, 0) + pendiente
            else:
                # OC legacy sin items
                insumo_id = oc.get("insumoId", "")
                if insumo_id:
                    cant = float(oc.get("cantidad", 0))
                    snapshot[insumo_id] = snapshot.get(insumo_id, 0) + cant

        return {"data": snapshot}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── BORRADORES MRP ──────────────────────────────────────────────────────────

class BorradorMRP(BaseModel):
    id: Optional[str] = None
    nombre: Optional[str] = None
    numeroPedido: Optional[str] = None
    fechaSolicitada: Optional[str] = None
    tiempoEntrega: Optional[str] = None
    notas: Optional[str] = None
    colchonSeguridad: Optional[float] = 10.0
    considerarStock: Optional[bool] = True
    considerarOCPendientes: Optional[bool] = True
    lineas: Optional[List[Dict[str, Any]]] = []
    cantidadesOverride: Optional[Dict[str, float]] = {}
    proveedoresOverride: Optional[Dict[str, str]] = {}


@router.get("/borradores")
def get_borradores():
    try:
        return {"data": compras_service.get_borradores()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/borradores")
def create_borrador(borrador: BorradorMRP):
    try:
        created = compras_service.create_borrador(borrador.model_dump())
        return {"message": "Borrador guardado", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/borradores/{borrador_id}")
def update_borrador(borrador_id: str, updates: Dict[str, Any]):
    try:
        compras_service.update_borrador(borrador_id, updates)
        return {"message": "Borrador actualizado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/borradores/{borrador_id}")
def delete_borrador(borrador_id: str):
    try:
        compras_service.delete_borrador(borrador_id)
        return {"message": "Borrador eliminado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── ENTREGA GLOBAL (una factura/RM → múltiples OCs) ──────────────────────────

class EntregaGlobalItem(BaseModel):
    insumoId: str
    insumo: str
    cantidadRecibida: float

class EntregaGlobalRequest(BaseModel):
    terceroId: str
    documentoRef: str
    fecha: str
    recibidoPor: str
    notas: Optional[str] = ""
    items: List[EntregaGlobalItem]


@router.post("/ordenes/registrar-entrega-global")
def registrar_entrega_global(req: EntregaGlobalRequest, background_tasks: BackgroundTasks):
    """
    Distribuye una entrega de proveedor (una factura/RM) entre todas sus OCs abiertas.
    Lógica FIFO: aplica primero a la OC más antigua.
    """
    import uuid

    try:
        all_ordenes = compras_service.get_ordenes_compra()

        ocs_abiertas = [
            o for o in all_ordenes
            if o.get("terceroId") == req.terceroId
            and o.get("estado") in ("Aprobada", "Parcial", "Pendiente")
        ]
        ocs_abiertas.sort(key=lambda o: o.get("created_at", ""), reverse=False)

        oc_pendientes = {}
        for oc in ocs_abiertas:
            pendientes = {}
            for it in (oc.get("items") or []):
                iid = it.get("insumoId", "")
                pend = max(0.0, float(it.get("cantidad", 0)) - float(it.get("cantidad_recibida", 0)))
                if pend > 0:
                    pendientes[iid] = pend
            if pendientes:
                oc_pendientes[oc["id"]] = pendientes

        distribucion = {}
        for item_req in req.items:
            restante = float(item_req.cantidadRecibida)
            iid = item_req.insumoId
            for oc in ocs_abiertas:
                if restante <= 0:
                    break
                oc_id = oc["id"]
                pend = oc_pendientes.get(oc_id, {}).get(iid, 0)
                if pend <= 0:
                    continue
                asignar = min(pend, restante)
                if oc_id not in distribucion:
                    distribucion[oc_id] = {}
                distribucion[oc_id][iid] = distribucion[oc_id].get(iid, 0) + asignar
                oc_pendientes[oc_id][iid] = pend - asignar
                restante -= asignar

        delivery_id = str(uuid.uuid4())
        ocs_afectadas = []

        for oc in ocs_abiertas:
            oc_id = oc["id"]
            if oc_id not in distribucion:
                continue
            asignados = distribucion[oc_id]
            items = list(oc.get("items") or [])

            for it in items:
                iid = it.get("insumoId", "")
                if iid in asignados:
                    it["cantidad_recibida"] = float(it.get("cantidad_recibida", 0)) + asignados[iid]

            delivery_items = [
                {"insumoId": iid,
                 "insumo": next((i.get("insumo", "") for i in items if i.get("insumoId") == iid), iid),
                 "cantidad": cant}
                for iid, cant in asignados.items()
            ]
            nueva_entrega = {
                "id": delivery_id,
                "fecha": req.fecha,
                "recibidoPor": req.recibidoPor,
                "documentoRef": req.documentoRef,
                "notas": req.notas or "",
                "items": delivery_items,
                "esEntregaGlobal": True
            }
            historial = list(oc.get("historialEntregas") or [])
            historial.append(nueva_entrega)

            all_done = all(float(it.get("cantidad_recibida", 0)) >= float(it.get("cantidad", 0)) for it in items)
            some_done = any(float(it.get("cantidad_recibida", 0)) > 0 for it in items)
            nuevo_estado = "Recibido" if all_done else ("Parcial" if some_done else oc.get("estado"))

            compras_service.update_orden_compra(oc_id, {
                "items": items,
                "historialEntregas": historial,
                "estado": nuevo_estado
            })
            ocs_afectadas.append({
                "oc_id": oc_id,
                "numeroPedido": oc.get("numeroPedido", oc_id[:8]),
                "nuevo_estado": nuevo_estado,
                "asignado": asignados
            })

        return {
            "message": f"Entrega registrada en {len(ocs_afectadas)} OC(s)",
            "delivery_id": delivery_id,
            "distribucion": ocs_afectadas
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── CONTROL LABORATORIO / MAQUILA ─────────────────────────────────────────────

class MaquilaProyeccion(BaseModel):
    year: int
    month: int
    sku: str
    nombre: Optional[str] = None
    cantidad_solicitada: int

class MaquilaEntrega(BaseModel):
    fechaRecepcion: str
    sku: str
    nombre: Optional[str] = None
    cantidad: int
    remision: Optional[str] = None

@router.get("/maquila/proyecciones/{year}")
def get_maquila_proyecciones(year: int):
    try:
        data = compras_service.get_maquila_proyecciones(year)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/maquila/proyecciones")
def save_maquila_proyeccion(req: MaquilaProyeccion):
    try:
        created = compras_service.save_maquila_proyeccion(req.model_dump())
        return {"message": "Proyección guardada", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/maquila/entregas/{year}")
def get_maquila_entregas(year: int):
    try:
        data = compras_service.get_maquila_entregas(year)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/maquila/entregas")
def create_maquila_entrega(req: MaquilaEntrega):
    try:
        created = compras_service.create_maquila_entrega(req.model_dump())
        return {"message": "Entrega registrada", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/maquila/entregas/{year}/{entrega_id}")
def delete_maquila_entrega(year: int, entrega_id: str):
    try:
        compras_service.delete_maquila_entrega(entrega_id, year)
        return {"message": "Entrega eliminada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
