"use client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Sparkles, Plus, X, ChevronRight, ShoppingCart, Package, Building2,
    AlertCircle, CheckCircle2, Wand2, FileDown, Trash2, Save, FolderOpen,
    Settings2, ArrowRightLeft, Clock, Boxes, TrendingUp, Archive, Loader2
} from "lucide-react";
import { ProductoFabricado, Insumo, Tercero, OrdenCompra, BorradorMRP } from "@/hooks/useCompras";
import { useOCSnapshot, useInventoryStock, useBorradores } from "@/hooks/useMRP";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { exportarOrdenesExcel, descargarZIPPedido } from "../utils/pdfExport";

// ── Helpers ──────────────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Parsea el campo rendimiento:
 * - "80%"  → 0.8  (eficiencia: pedir 25% más para compensar merma)
 * - "12"   → 12  (empaque: 12 unidades por caja → dividir para saber # cajas)
 * - "0.85" → 0.85 (fracción directa de eficiencia)
 * En todos los casos: cantidadFinal = cantBruta / factor
 */
function parseRendimientoFactor(raw: string | undefined): number {
    if (!raw || raw.trim() === "" || raw === "N/A") return 1;
    const s = raw.trim();
    if (s.includes("%")) {
        const n = parseFloat(s.replace("%", ""));
        if (!isNaN(n) && n > 0) return n / 100;
    }
    const n = parseFloat(s);
    if (!isNaN(n) && n > 0) return n;   // <1 = eficiencia | >1 = unidades/empaque
    return 1;
}

/** Devuelve true si el campo rendimiento indica "unidades por empaque" (n > 1) */
function esEmpaque(raw: string | undefined): boolean {
    if (!raw) return false;
    if (raw.includes("%")) return false;
    const n = parseFloat(raw.trim());
    return !isNaN(n) && n > 1;
}

/** Redondea hacia arriba al múltiplo de loteMinimo. */
function redondearLote(qty: number, loteMinimo: number): number {
    if (!loteMinimo || loteMinimo <= 0) return Math.ceil(qty);
    return Math.ceil(qty / loteMinimo) * loteMinimo;
}


// ── Tipos internos ────────────────────────────────────────────────────────────
interface LineaPedido { uuid: string; productoId: string; cantidad: number }

interface InsumoRequerido {
    insumoId: string;
    insumoNombre: string;
    insumoSku: string;
    cantidadBruta: number;
    cantidadConRendimiento: number;
    rendimientoFactor: number;      // el divisor real usado
    esEmpaqueInsumo: boolean;       // true si rendimiento > 1 (unidades/caja)
    unidadesPorEmpaque: number;     // si es empaque: cuántas unidades caben
    stockDisponible: number;
    ocPendiente: number;
    cantidadNeta: number;
    cantidadConColchon: number;
    cantidadLote: number;
    cantidadFinal: number;
    unidad: string;
    precioUnitario: number;
    subtotal: number;
    loteMinimo: number;
    origenProductos: { nombre: string; cantidad: number; cantUnitaria: number; totalUnidades: number }[];
    proveedoresDisponibles: { terceroId: string; nombre: string; precio: number }[];
    terceroIdAsignado: string;
    terceroNombreAsignado: string;
    // Para empaques alternativos del mismo grupo producto+clasificacion
    grupoEmpaque?: string;  // key = productoId:clasificacion
    pctSplit?: number;      // % asignado a este empaque (0-100)
}

interface OrdenPorProveedor {
    terceroId: string;
    terceroNombre: string;
    terceroCorreo: string;
    terceroNit: string;
    insumos: InsumoRequerido[];
    totalEstimado: number;
    seleccionada: boolean;
}

interface GeneradorPedidoSectionProps {
    productos: ProductoFabricado[];
    insumos: Insumo[];
    terceros: Tercero[];
    ordenes: OrdenCompra[];
    createOrden: (o: Partial<OrdenCompra>) => Promise<boolean>;
    updateOrden: (id: string, o: Partial<OrdenCompra>) => Promise<boolean>;
}

export const GeneradorPedidoSection = ({
    productos, insumos, terceros, ordenes, createOrden,
}: GeneradorPedidoSectionProps) => {

    // ── Parámetros de planificación ──────────────────────────────────────────
    const [numeroPedido, setNumeroPedido] = useState("");
    const [fechaSolicitada, setFechaSolicitada] = useState(format(new Date(), "yyyy-MM-dd"));
    const [tiempoEntrega, setTiempoEntrega] = useState("");
    const [notas, setNotas] = useState("");
    const [colchonSeguridad, setColchonSeguridad] = useState(10);
    const [considerarStock, setConsiderarStock] = useState(true);
    const [considerarOCPendientes, setConsiderarOCPendientes] = useState(true);
    const [lineas, setLineas] = useState<LineaPedido[]>([{ uuid: uid(), productoId: "", cantidad: 1 }]);
    const [cantidadesOverride, setCantidadesOverride] = useState<Record<string, number>>({});
    const [proveedoresOverride, setProveedoresOverride] = useState<Record<string, string>>({});
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set(["__ALL__"]));

    // ── UI state ───────────────────────────────────────────────────────────────────────
    const [generando, setGenerando] = useState(false);
    const [generandoZIP, setGenerandoZIP] = useState(false);
    const [zipProgress, setZipProgress] = useState(0);
    const [ordenesGeneradas, setOrdenesGeneradas] = useState<string[]>([]);
    const [ordenesGeneradasObj, setOrdenesGeneradasObj] = useState<OrdenCompra[]>([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showBorradores, setShowBorradores] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [borradorNombre, setBorradorNombre] = useState("");
    const [borradorActualId, setBorradorActualId] = useState<string | null>(null);
    // Split % para empaques alternativos: key = grupoeId, value = Record<insumoId, pct>
    const [empaquesSplit, setEmpaquesSplit] = useState<Record<string, Record<string, number>>>({});

    // ── Data externa ─────────────────────────────────────────────────────────
    const { data: ocSnapshot = {} } = useOCSnapshot();
    const { data: stockSnapshot = {}, isLoading: loadingStock } = useInventoryStock();
    const { borradores, saveBorrador, updateBorrador, deleteBorrador } = useBorradores();

    // ── Acciones de líneas ───────────────────────────────────────────────────
    const addLinea = () => setLineas(p => [...p, { uuid: uid(), productoId: "", cantidad: 1 }]);
    const removeLinea = (uuid: string) => setLineas(p => p.filter(l => l.uuid !== uuid));
    const updateLinea = (uuid: string, f: keyof Omit<LineaPedido, "uuid">, v: any) =>
        setLineas(p => p.map(l => l.uuid === uuid ? { ...l, [f]: v } : l));

    // ── Núcleo del cálculo MRP ────────────────────────────────────────────────
    const requisicion = useMemo((): OrdenPorProveedor[] => {
        const validas = lineas.filter(l => l.productoId && l.cantidad > 0);
        if (!validas.length) return [];

        // PASO 1: Explosión BOM
        const insumoMap = new Map<string, InsumoRequerido>();
        // grupoEmpaque: por producto + clasificación → [insumoId, ...]
        const gruposEmpaque = new Map<string, string[]>();

        for (const linea of validas) {
            const prod = productos.find(p => p.id === linea.productoId);
            if (!prod?.insumosAsociados?.length) continue;

            for (const ia of prod.insumosAsociados) {
                const ins = insumos.find(i => i.id === ia.insumoId);
                if (!ins) continue;

                const rendFactor = parseRendimientoFactor(ins.rendimiento);
                const esEmpq = esEmpaque(ins.rendimiento);
                const unidadesPorEmpq = esEmpq ? rendFactor : 1;

                // Para empaques: cantBruta = unidades del producto a fabricar
                // Para materia prima normal: cantBruta = cantidadRequerida * cantidad
                let cantBruta: number;
                let cantConRend: number;

                if (esEmpq) {
                    // El campo cantidadRequerida en BOM puede ser 1 (relativo a la unidad de producto)
                    // La cantidad de cajas = ceil(unidades / unidadesPorCaja * pctSplit)
                    // Acumulamos unidades brutas para luego aplicar el split
                    cantBruta = linea.cantidad;      // unidades de producto
                    cantConRend = linea.cantidad;    // se calculará al aplicar split
                } else {
                    cantBruta = ia.cantidadRequerida * linea.cantidad;
                    cantConRend = cantBruta / rendFactor;
                }

                if (insumoMap.has(ia.insumoId)) {
                    const ex = insumoMap.get(ia.insumoId)!;
                    ex.cantidadBruta += cantBruta;
                    ex.cantidadConRendimiento += cantConRend;
                    ex.origenProductos.push({ nombre: prod.nombre, cantidad: linea.cantidad, cantUnitaria: ia.cantidadRequerida, totalUnidades: linea.cantidad });
                } else {
                    const provsDisponibles = terceros
                        .filter(t => (t.insumos || "").toLowerCase().includes(`[${ins.sku.toLowerCase()}]`) ||
                            t.insumosPrecios?.some(ip => ip.insumoId === ia.insumoId))
                        .map(t => ({
                            terceroId: t.id,
                            nombre: t.nombre,
                            precio: t.insumosPrecios?.find(ip => ip.insumoId === ia.insumoId)?.precio ?? ins.precio ?? 0,
                        }))
                        .sort((a, b) => a.precio - b.precio);

                    // Detectar grupo de empaques alternativos
                    const clasificacion = ins.clasificacion || "General";
                    const grupoKey = esEmpq ? `${prod.id}:${clasificacion}` : undefined;
                    if (grupoKey) {
                        const arr = gruposEmpaque.get(grupoKey) ?? [];
                        arr.push(ia.insumoId);
                        gruposEmpaque.set(grupoKey, arr);
                    }

                    insumoMap.set(ia.insumoId, {
                        insumoId: ia.insumoId,
                        insumoNombre: ins.nombre,
                        insumoSku: ins.sku,
                        cantidadBruta: cantBruta,
                        cantidadConRendimiento: cantConRend,
                        rendimientoFactor: rendFactor,
                        esEmpaqueInsumo: esEmpq,
                        unidadesPorEmpaque: unidadesPorEmpq,
                        stockDisponible: 0,
                        ocPendiente: 0,
                        cantidadNeta: 0,
                        cantidadConColchon: 0,
                        cantidadLote: 0,
                        cantidadFinal: 0,
                        unidad: ins.unidad,
                        precioUnitario: provsDisponibles[0]?.precio ?? ins.precio ?? 0,
                        subtotal: 0,
                        loteMinimo: ins.loteMinimo ?? 0,
                        origenProductos: [{ nombre: prod.nombre, cantidad: linea.cantidad, cantUnitaria: ia.cantidadRequerida, totalUnidades: linea.cantidad }],
                        proveedoresDisponibles: provsDisponibles,
                        terceroIdAsignado: proveedoresOverride[ia.insumoId] ?? provsDisponibles[0]?.terceroId ?? "__SIN_PROVEEDOR__",
                        terceroNombreAsignado: "",
                        grupoEmpaque: grupoKey,
                        pctSplit: 100,
                    });
                }
            }
        }

        // PASO 1b: Aplicar splits a grupos de empaques alternativos
        for (const [grupoKey, insumoIds] of gruposEmpaque) {
            if (insumoIds.length < 2) continue;  // solo 1 caja → no hay split

            const splitUser = empaquesSplit[grupoKey]; // Record<insumoId, pct> del usuario

            // Calcular splits: si el usuario no configuró, distribuir equitativamente
            let totalPct = 0;
            const splits: Record<string, number> = {};
            for (const iid of insumoIds) {
                splits[iid] = splitUser?.[iid] ?? Math.round(100 / insumoIds.length);
                totalPct += splits[iid];
            }
            // Normalizar a 100%
            const factor100 = 100 / totalPct;
            for (const iid of insumoIds) splits[iid] = Math.round(splits[iid] * factor100);

            // Aplicar al cálculo de cada empaque
            for (const iid of insumoIds) {
                const req = insumoMap.get(iid);
                if (!req) continue;
                const pct = splits[iid];
                req.pctSplit = pct;
                // Unidades que va a manejar este empaque = totalUnidades * pct%
                const unidadesParaEsteEmpaque = req.cantidadBruta * (pct / 100);
                // Cantidad de cajas necesarias = ceil(unidades / unidadesPorCaja)
                req.cantidadConRendimiento = Math.ceil(unidadesParaEsteEmpaque / req.unidadesPorEmpaque);
            }
        }

        // Para empaques que NO tienen alternativas (grupo de 1), calcular normalmente
        for (const [, req] of insumoMap) {
            if (req.esEmpaqueInsumo && (req.pctSplit === 100 || !req.grupoEmpaque)) {
                req.cantidadConRendimiento = Math.ceil(req.cantidadBruta / req.unidadesPorEmpaque);
            }
        }

        // PASO 2: Aplicar stock, OC pendientes, colchón, lote mínimo y override
        for (const [, req] of insumoMap) {
            req.stockDisponible = considerarStock ? (stockSnapshot[req.insumoSku] ?? 0) : 0;
            req.ocPendiente = considerarOCPendientes ? (ocSnapshot[req.insumoId] ?? 0) : 0;

            const neta = Math.max(0, req.cantidadConRendimiento - req.stockDisponible - req.ocPendiente);
            req.cantidadNeta = neta;
            req.cantidadConColchon = neta * (1 + colchonSeguridad / 100);
            req.cantidadLote = redondearLote(req.cantidadConColchon, req.loteMinimo);
            req.cantidadFinal = cantidadesOverride[req.insumoId] ?? req.cantidadLote;

            // Aplicar override de proveedor si existe
            const provId = proveedoresOverride[req.insumoId] ?? req.terceroIdAsignado;
            req.terceroIdAsignado = provId;
            const provInfo = req.proveedoresDisponibles.find(p => p.terceroId === provId);
            req.terceroNombreAsignado = provInfo?.nombre ?? terceros.find(t => t.id === provId)?.nombre ?? "⚠️ Sin Proveedor";
            req.precioUnitario = provInfo?.precio ?? req.precioUnitario;
            req.subtotal = req.cantidadFinal * req.precioUnitario;
        }

        // PASO 3: Agrupar por proveedor asignado
        const provMap = new Map<string, OrdenPorProveedor>();
        for (const [, req] of insumoMap) {
            if (req.cantidadFinal <= 0) continue; // no pedir lo que no se necesita
            const key = req.terceroIdAsignado;
            const t = terceros.find(t => t.id === key);
            if (!provMap.has(key)) {
                provMap.set(key, {
                    terceroId: key,
                    terceroNombre: req.terceroNombreAsignado,
                    terceroCorreo: t?.correo ?? "",
                    terceroNit: t?.nit ?? "",
                    insumos: [],
                    totalEstimado: 0,
                    seleccionada: true,
                });
            }
            const prov = provMap.get(key)!;
            prov.insumos.push(req);
            prov.totalEstimado += req.subtotal;
        }
        return Array.from(provMap.values()).sort((a, b) => b.totalEstimado - a.totalEstimado);
    }, [lineas, productos, insumos, terceros, ocSnapshot, stockSnapshot, colchonSeguridad,
        considerarStock, considerarOCPendientes, cantidadesOverride, proveedoresOverride, empaquesSplit]);

    const totalGeneral = useMemo(() =>
        requisicion.filter(r => seleccionados.has("__ALL__") || seleccionados.has(r.terceroId))
            .reduce((s, p) => s + p.totalEstimado, 0), [requisicion, seleccionados]);

    // ── Toggle selección de proveedores ───────────────────────────────────
    const toggleSeleccionado = (id: string) => {
        setSeleccionados(prev => {
            const next = new Set(prev);
            if (next.has("__ALL__")) {
                next.delete("__ALL__");
                requisicion.forEach(r => { if (r.terceroId !== id) next.add(r.terceroId); });
            } else {
                next.has(id) ? next.delete(id) : next.add(id);
            }
            return next;
        });
    };

    // ── Actualizar split de empaque alternativo ──────────────────────────────
    const updateEmpaquesSplit = (grupoKey: string, insumoId: string, pct: number) => {
        setEmpaquesSplit(prev => ({
            ...prev,
            [grupoKey]: { ...(prev[grupoKey] ?? {}), [insumoId]: pct },
        }));
    };

    // Detectar grupos con empaques alternativos (para mostrar widget)
    const gruposConAlternativas = useMemo(() => {
        const map = new Map<string, InsumoRequerido[]>();
        for (const prov of requisicion) {
            for (const ins of prov.insumos) {
                if (ins.grupoEmpaque && ins.esEmpaqueInsumo) {
                    const arr = map.get(ins.grupoEmpaque) ?? [];
                    arr.push(ins);
                    map.set(ins.grupoEmpaque, arr);
                }
            }
        }
        return map;
    }, [requisicion]);


    // ── Guardar borrador ─────────────────────────────────────────────────────
    const handleGuardarBorrador = async () => {
        const data: Partial<BorradorMRP> = {
            nombre: borradorNombre || `Pedido ${numeroPedido || "sin número"} — ${format(new Date(), "dd/MM HH:mm")}`,
            numeroPedido, fechaSolicitada, tiempoEntrega, notas,
            colchonSeguridad, considerarStock, considerarOCPendientes,
            lineas: lineas.filter(l => l.productoId).map(l => ({ productoId: l.productoId, cantidad: l.cantidad })),
            cantidadesOverride, proveedoresOverride, empaquesSplit,
        };
        if (borradorActualId) {
            await updateBorrador(borradorActualId, data);
        } else {
            const ok = await saveBorrador(data);
            if (ok) setBorradorActualId(null);
        }
    };

    // ── Cargar borrador ──────────────────────────────────────────────────────
    const handleCargarBorrador = (b: BorradorMRP) => {
        setBorradorActualId(b.id);
        setBorradorNombre(b.nombre ?? "");
        setNumeroPedido(b.numeroPedido ?? "");
        setFechaSolicitada(b.fechaSolicitada ?? format(new Date(), "yyyy-MM-dd"));
        setTiempoEntrega(b.tiempoEntrega ?? "");
        setNotas(b.notas ?? "");
        setColchonSeguridad(b.colchonSeguridad ?? 10);
        setConsiderarStock(b.considerarStock ?? true);
        setConsiderarOCPendientes(b.considerarOCPendientes ?? true);
        setLineas((b.lineas ?? []).map(l => ({ uuid: uid(), productoId: l.productoId, cantidad: l.cantidad })));
        setCantidadesOverride(b.cantidadesOverride ?? {});
        setProveedoresOverride(b.proveedoresOverride ?? {});
        setEmpaquesSplit(b.empaquesSplit ?? {});
        setShowBorradores(false);
        toast.success(`Borrador "${b.nombre}" cargado`);
    };

    // ── Generar OC ──────────────────────────────────────────────────────────────────────
    const handleGenerar = async () => {
        if (!numeroPedido.trim()) { toast.error("Ingresa el número de pedido."); return; }
        const provValidos = requisicion.filter(r =>
            r.terceroId !== "__SIN_PROVEEDOR__" &&
            (seleccionados.has("__ALL__") || seleccionados.has(r.terceroId))
        );
        if (!provValidos.length) { toast.error("No hay órdenes válidas seleccionadas."); return; }
        setGenerando(true);
        setShowConfirm(false);
        const generadas: string[] = [];
        const generadasObj: OrdenCompra[] = [];
        const base = numeroPedido.trim().toUpperCase();

        for (const prov of provValidos) {
            const existing = ordenes.filter(o => {
                const parts = o.id.split('-');
                return parts.slice(0, -1).join('-') === base;
            });
            let maxSeq = existing.reduce((m, o) => {
                const n = parseInt(o.id.split('-').pop() ?? "0", 10);
                return isNaN(n) ? m : Math.max(m, n);
            }, 0);
            maxSeq += generadas.length;
            const newId = `${base}-${(maxSeq + 1).toString().padStart(3, '0')}`;

            const items = prov.insumos.map(ins => ({
                insumoId: ins.insumoId,
                insumo: ins.insumoNombre,
                cantidad: ins.cantidadFinal,
                unidad: ins.unidad,
                precio_estimado: ins.precioUnitario,
                cantidad_recibida: 0,
            }));
            const label = items.map(i => i.insumo).join(', ');
            const totalBruto = items.reduce((s, i) => s + i.cantidad * i.precio_estimado, 0);
            const now = new Date().toISOString();

            const ocData: Partial<OrdenCompra> = {
                id: newId, terceroId: prov.terceroId, insumo: label,
                cantidad: items.reduce((s, i) => s + i.cantidad, 0),
                unidad: items[0]?.unidad ?? "Unidad",
                precio_estimado: items[0]?.precio_estimado ?? 0,
                total_bruto: totalBruto, items,
                estado: "Pendiente", numeroPedido: numeroPedido.trim(),
                fechaSolicitada, tiempoEntrega,
                notas: notas || `Generado MRP — Pedido ${numeroPedido}. Colchón: ${colchonSeguridad}%`,
                created_at: now,
            };
            const ok = await createOrden(ocData);
            if (ok) {
                generadas.push(newId);
                generadasObj.push(ocData as OrdenCompra);
            }
        }

        setOrdenesGeneradas(generadas);
        setOrdenesGeneradasObj(generadasObj);
        setGenerando(false);
        if (generadas.length) toast.success(`✅ ${generadas.length} OC generada(s) para Pedido ${numeroPedido}`);
    };


    const handleLimpiar = () => {
        setLineas([{ uuid: uid(), productoId: "", cantidad: 1 }]);
        setNumeroPedido(""); setNotas(""); setOrdenesGeneradas([]); setOrdenesGeneradasObj([]);
        setTiempoEntrega(""); setCantidadesOverride({});
        setProveedoresOverride({}); setEmpaquesSplit({}); setBorradorActualId(null); setBorradorNombre("");
    };

    // ── Descargar ZIP con todos los PDFs ────────────────────────────────────────
    const handleDescargarZIP = async () => {
        if (!ordenesGeneradasObj.length) return;
        setGenerandoZIP(true);
        setZipProgress(0);
        try {
            await descargarZIPPedido(
                ordenesGeneradasObj,
                terceros,
                insumos,
                numeroPedido,
                (pct) => setZipProgress(pct)
            );
            toast.success(`📦 ZIP descargado con ${ordenesGeneradasObj.length} PDF(s)`);
        } catch (e) {
            toast.error("No se pudo generar el ZIP. ¿Instalaste jszip? (npm install jszip)");
        } finally {
            setGenerandoZIP(false);
        }
    };


    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-violet-600" />
                        Generador de Orden por Pedido · MRP
                        {borradorActualId && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Editando borrador</span>}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Explosión de ficha técnica → descuento de stock + OC en tránsito → generación automática de OC por proveedor
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowBorradores(true)} className="text-xs">
                        <FolderOpen className="w-3.5 h-3.5 mr-1" /> Borradores ({borradores.length})
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowConfig(c => !c)} className="text-xs">
                        <Settings2 className="w-3.5 h-3.5 mr-1" /> Parámetros
                    </Button>
                </div>
            </div>

            {/* Panel de Configuración */}
            {showConfig && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1 col-span-2 md:col-span-1">
                        <label className="text-xs font-bold text-violet-700 uppercase">Colchón de Seguridad</label>
                        <div className="flex items-center gap-2">
                            <input type="range" min={0} max={50} step={5} value={colchonSeguridad}
                                onChange={e => setColchonSeguridad(Number(e.target.value))}
                                className="flex-1 accent-violet-600" />
                            <span className="text-sm font-black text-violet-700 w-10">{colchonSeguridad}%</span>
                        </div>
                        <p className="text-[10px] text-violet-500">Extra sobre cantidad neta calculada</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-violet-700 uppercase">Descontar Stock</label>
                        <button onClick={() => setConsiderarStock(c => !c)}
                            className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${considerarStock ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                            {considerarStock ? "✓ Activo" : "Inactivo"}
                        </button>
                        <p className="text-[10px] text-violet-500">Resta stock de bodega actual</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-violet-700 uppercase">Descontar OC Activas</label>
                        <button onClick={() => setConsiderarOCPendientes(c => !c)}
                            className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${considerarOCPendientes ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                            {considerarOCPendientes ? "✓ Activo" : "Inactivo"}
                        </button>
                        <p className="text-[10px] text-violet-500">Resta OC pendientes/aprobadas</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-violet-700 uppercase">Nombre del Borrador</label>
                        <Input value={borradorNombre} onChange={e => setBorradorNombre(e.target.value)} className="text-xs h-8" placeholder="Ej. Pedido Mayo semana 1" />
                        <Button size="sm" onClick={handleGuardarBorrador} className="w-full h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white mt-1">
                            <Save className="w-3 h-3 mr-1" /> Guardar Borrador
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* ── PANEL IZQUIERDO ──────────────────────────────────────── */}
                <div className="space-y-4">
                    {/* Datos del pedido */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                        <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-violet-500" /> Datos del Pedido
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">No. Pedido *</label>
                                <Input value={numeroPedido} onChange={e => setNumeroPedido(e.target.value.toUpperCase())}
                                    placeholder="Ej. 55" className="font-mono font-bold h-10" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Fecha Solicitada</label>
                                <Input type="date" value={fechaSolicitada} onChange={e => setFechaSolicitada(e.target.value)} className="h-10" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tiempo de Entrega</label>
                                <Input value={tiempoEntrega} onChange={e => setTiempoEntrega(e.target.value)} placeholder="Ej. 5 días hábiles" className="h-10" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Notas</label>
                                <Input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones" className="h-10" />
                            </div>
                        </div>
                    </div>

                    {/* Líneas de productos */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                                <Package className="w-4 h-4 text-violet-500" /> Productos del Pedido
                            </h3>
                            <Button size="sm" variant="outline" onClick={addLinea} className="h-7 text-xs">
                                <Plus className="w-3 h-3 mr-1" /> Agregar
                            </Button>
                        </div>
                        {lineas.map((linea, idx) => (
                            <div key={linea.uuid} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-black text-gray-300 w-4 shrink-0">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <Select value={linea.productoId} onValueChange={v => updateLinea(linea.uuid, "productoId", v)}>
                                        <SelectTrigger className="h-9 bg-white text-xs">
                                            <SelectValue placeholder="Seleccionar producto..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {productos.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    <span className="font-mono text-[10px] text-gray-400 mr-1">{p.sku}</span>
                                                    {p.nombre}
                                                    {!p.insumosAsociados?.length && <span className="ml-1 text-[10px] text-red-400">⚠️ sin ficha</span>}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Input type="number" min={1} value={linea.cantidad}
                                    onChange={e => updateLinea(linea.uuid, "cantidad", Number(e.target.value))}
                                    className="w-20 h-9 text-center font-bold text-sm" />
                                {lineas.length > 1 && (
                                    <Button variant="ghost" size="icon" onClick={() => removeLinea(linea.uuid)}
                                        className="text-red-400 hover:bg-red-50 h-8 w-8 shrink-0">
                                        <X className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        {lineas.some(l => { const p = productos.find(p => p.id === l.productoId); return p && !p.insumosAsociados?.length; }) && (
                            <div className="flex gap-2 text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-xs">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p>Algunos productos no tienen ficha técnica. Agrégala en <strong>Productos Fabricados</strong>.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── PANEL DERECHO: Resultado MRP ─────────────────────────── */}
                <div className="space-y-4">
                    {requisicion.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 flex flex-col items-center text-center gap-3 min-h-[320px] justify-center">
                            <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center">
                                <Sparkles className="w-7 h-7 text-violet-400" />
                            </div>
                            <p className="text-gray-400 text-sm max-w-xs">
                                Completa los productos del pedido para ver el cálculo MRP automático.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Resumen */}
                            <div className="bg-gradient-to-r from-[#183C30] to-[#2a6348] text-white rounded-2xl p-5 shadow-md">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs opacity-60">Total Pedido {numeroPedido || "—"} · {requisicion.length} proveedor(es)</p>
                                        <p className="text-3xl font-black">${totalGeneral.toLocaleString("es-CO")}</p>
                                        <div className="flex gap-3 mt-2 text-xs opacity-70">
                                            {considerarStock && <span className="flex items-center gap-1"><Boxes className="w-3 h-3" /> Stock descontado</span>}
                                            {considerarOCPendientes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> OC activas descontadas</span>}
                                            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +{colchonSeguridad}% colchón</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => exportarOrdenesExcel(
                                            requisicion.map(prov => ({
                                                id: `${numeroPedido}-PREVIEW`, terceroId: prov.terceroId,
                                                insumo: prov.insumos.map(i => i.insumoNombre).join(", "),
                                                cantidad: prov.insumos.reduce((s, i) => s + i.cantidadFinal, 0),
                                                unidad: "Varios", precio_estimado: 0, total_bruto: prov.totalEstimado,
                                                estado: "Pendiente" as const, numeroPedido, fechaSolicitada,
                                                items: prov.insumos.map(i => ({ insumoId: i.insumoId, insumo: i.insumoNombre, cantidad: i.cantidadFinal, unidad: i.unidad, precio_estimado: i.precioUnitario })),
                                            })), terceros
                                        )} className="text-xs bg-white/20 text-white hover:bg-white/30 border-white/30">
                                            <FileDown className="w-3 h-3 mr-1" /> Excel
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={handleLimpiar}
                                            className="text-xs bg-white/10 text-white hover:bg-white/20 border-white/20">
                                            <Trash2 className="w-3 h-3 mr-1" /> Limpiar
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* ── Widget empaques alternativos ─────────── */}
                            {gruposConAlternativas.size > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Boxes className="w-4 h-4 text-amber-600" />
                                        <p className="font-bold text-amber-800 text-sm">Distribución de Empaques Alternativos</p>
                                    </div>
                                    <p className="text-xs text-amber-600">Este producto tiene múltiples opciones de caja. Define qué % de unidades va en cada una (deben sumar 100%).</p>
                                    {Array.from(gruposConAlternativas.entries()).map(([grupoKey, items]) => {
                                        const splitActual = empaquesSplit[grupoKey] ?? {};
                                        const totalPct = items.reduce((s, i) => s + (splitActual[i.insumoId] ?? Math.round(100 / items.length)), 0);
                                        const ok = Math.abs(totalPct - 100) <= 1;
                                        return (
                                            <div key={grupoKey} className="bg-white rounded-xl border border-amber-100 p-3 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                                        {items[0]?.origenProductos?.[0]?.nombre ?? "Producto"}
                                                    </p>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                                                        Total: {totalPct}% {ok ? "✓" : "⚠ suma ≠ 100"}
                                                    </span>
                                                </div>
                                                {items.map(ins => {
                                                    const defaultPct = Math.round(100 / items.length);
                                                    const pct = splitActual[ins.insumoId] ?? defaultPct;
                                                    const unidades = Math.round(ins.cantidadBruta * (pct / 100));
                                                    const cajas = Math.ceil(unidades / ins.unidadesPorEmpaque);
                                                    return (
                                                        <div key={ins.insumoId} className="flex items-center gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-gray-800 truncate">{ins.insumoNombre}</p>
                                                                <p className="text-[10px] text-gray-400">{ins.unidadesPorEmpaque} uds/caja · {cajas} cajas para {unidades} uds</p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <Input
                                                                    type="number" min={0} max={100}
                                                                    value={pct}
                                                                    onChange={e => updateEmpaquesSplit(grupoKey, ins.insumoId, Math.min(100, Math.max(0, Number(e.target.value))))}
                                                                    className="w-16 h-8 text-center text-sm font-bold border-amber-200"
                                                                />
                                                                <span className="text-xs text-gray-400 font-bold">%</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Cards por proveedor */}
                            <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                                {requisicion.map((prov, idx) => {
                                    const sinProv = prov.terceroId === "__SIN_PROVEEDOR__";
                                    const isSelected = seleccionados.has("__ALL__") || seleccionados.has(prov.terceroId);
                                    return (
                                        <div key={idx} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${sinProv ? "border-red-200" : isSelected ? "border-violet-200" : "border-gray-100 opacity-60"}`}>
                                            <div className={`px-4 py-3 flex items-center gap-3 ${sinProv ? "bg-red-50" : "bg-gray-50"}`}>
                                                {/* Checkbox selección */}
                                                {!sinProv && (
                                                    <input type="checkbox" checked={isSelected}
                                                        onChange={() => toggleSeleccionado(prov.terceroId)}
                                                        className="w-4 h-4 accent-violet-600 cursor-pointer" />
                                                )}
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black ${sinProv ? "bg-red-400" : "bg-[#183C30]"}`}>
                                                    {sinProv ? "!" : (idx + 1)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-bold text-sm truncate ${sinProv ? "text-red-700" : "text-gray-800"}`}>{prov.terceroNombre}</p>
                                                    {!sinProv && <p className="text-[10px] text-gray-400">NIT: {prov.terceroNit}</p>}
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="font-black text-[#183C30] text-sm">${prov.totalEstimado.toLocaleString("es-CO")}</p>
                                                    <p className="text-[10px] text-gray-400">{prov.insumos.length} ítems</p>
                                                </div>
                                            </div>

                                            <div className="divide-y divide-gray-50">
                                                {prov.insumos.map((ins, iIdx) => (
                                                    <div key={iIdx} className="px-4 py-3 space-y-2">
                                                        <div className="flex items-start gap-2 justify-between">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-semibold text-sm text-gray-800 truncate">{ins.insumoNombre}</p>
                                                                <p className="text-[10px] text-gray-400 font-mono">{ins.insumoSku}</p>
                                                            </div>
                                                            {/* Cantidad editable */}
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <div className="text-right">
                                                                    <Input type="number" min={0} step={ins.loteMinimo || 1}
                                                                        value={cantidadesOverride[ins.insumoId] ?? ins.cantidadFinal}
                                                                        onChange={e => setCantidadesOverride(prev => ({ ...prev, [ins.insumoId]: Number(e.target.value) }))}
                                                                        className="w-24 h-8 text-center font-bold text-sm" />
                                                                    <p className="text-[10px] text-gray-400 mt-0.5">{ins.unidad} · ${ins.precioUnitario.toLocaleString()}/u</p>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="font-black text-teal-600 text-sm">${ins.subtotal.toLocaleString("es-CO")}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Descomposición del cálculo */}
                                                        <div className="grid grid-cols-3 gap-1 text-[10px] bg-gray-50 rounded-lg p-2">
                                                            <div className="text-center">
                                                                <p className="text-gray-400">BOM bruto</p>
                                                                <p className="font-bold">{ins.cantidadBruta.toLocaleString()}</p>
                                                            </div>
                                                            {ins.cantidadBruta !== ins.cantidadConRendimiento && (
                                                                <div className="text-center">
                                                                    <p className="text-amber-500">+Rendimiento</p>
                                                                    <p className="font-bold text-amber-600">{ins.cantidadConRendimiento.toFixed(1)}</p>
                                                                </div>
                                                            )}
                                                            {ins.stockDisponible > 0 && (
                                                                <div className="text-center">
                                                                    <p className="text-emerald-500">-Stock</p>
                                                                    <p className="font-bold text-emerald-600">-{ins.stockDisponible.toLocaleString()}</p>
                                                                </div>
                                                            )}
                                                            {ins.ocPendiente > 0 && (
                                                                <div className="text-center">
                                                                    <p className="text-blue-500">-En tránsito</p>
                                                                    <p className="font-bold text-blue-600">-{ins.ocPendiente.toLocaleString()}</p>
                                                                </div>
                                                            )}
                                                            {ins.loteMinimo > 0 && (
                                                                <div className="text-center">
                                                                    <p className="text-violet-500">Lote mín.</p>
                                                                    <p className="font-bold text-violet-600">x{ins.loteMinimo}</p>
                                                                </div>
                                                            )}
                                                            <div className="text-center font-black">
                                                                <p className="text-gray-500">A pedir</p>
                                                                <p className="text-[#183C30]">{ins.cantidadFinal.toLocaleString()}</p>
                                                            </div>
                                                        </div>

                                                        {/* Comparación de proveedores alternativos */}
                                                        {ins.proveedoresDisponibles.length > 1 && (
                                                            <div className="space-y-1">
                                                                <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                                                    <ArrowRightLeft className="w-3 h-3" /> Proveedores disponibles:
                                                                </p>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {ins.proveedoresDisponibles.map(pd => (
                                                                        <button key={pd.terceroId}
                                                                            onClick={() => setProveedoresOverride(prev => ({ ...prev, [ins.insumoId]: pd.terceroId }))}
                                                                            className={`text-[10px] px-2 py-0.5 rounded-full border font-bold transition-all ${proveedoresOverride[ins.insumoId] === pd.terceroId || (!proveedoresOverride[ins.insumoId] && pd.terceroId === ins.proveedoresDisponibles[0]?.terceroId) ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 text-gray-500 hover:border-violet-300"}`}>
                                                                            {pd.nombre} · ${pd.precio.toLocaleString()}/u
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Trazabilidad de origen */}
                                                        <div className="flex flex-wrap gap-1">
                                                            {ins.origenProductos.map((o, oIdx) => (
                                                                <span key={oIdx} className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full">
                                                                    {o.nombre} × {o.cantidad} → {(o.cantUnitaria * o.cantidad).toFixed(2)} {ins.unidad}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {sinProv && (
                                                <div className="px-4 pb-3">
                                                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        Sin proveedor asignado. Agrega el SKU del insumo en el perfil del proveedor.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Botón Generar / Confirmación */}
                            {ordenesGeneradas.length === 0 ? (
                                <Button onClick={() => setShowConfirm(true)}
                                    disabled={generando || !numeroPedido.trim()}
                                    className="w-full h-12 bg-[#183C30] hover:bg-[#122e24] text-white font-bold rounded-2xl shadow-lg text-sm">
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Revisar y Generar {requisicion.filter(r => (seleccionados.has("__ALL__") || seleccionados.has(r.terceroId)) && r.terceroId !== "__SIN_PROVEEDOR__").length} OC
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                                            <div>
                                                <p className="font-bold text-emerald-800 text-sm">{ordenesGeneradas.length} OC generadas · Pedido {numeroPedido}</p>
                                                <p className="text-xs text-emerald-600 font-mono">{ordenesGeneradas.join(" · ")}</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" onClick={handleLimpiar} className="border-emerald-300 text-emerald-700 text-xs shrink-0">
                                            Nuevo Pedido
                                        </Button>
                                    </div>
                                    {/* Botón descarga ZIP */}
                                    <Button onClick={handleDescargarZIP} disabled={generandoZIP}
                                        className="w-full h-11 bg-[#183C30] hover:bg-[#122e24] text-white font-bold rounded-xl">
                                        {generandoZIP ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Generando ZIP... {zipProgress}%
                                                <div className="ml-3 flex-1 max-w-24 h-2 bg-white/20 rounded-full overflow-hidden">
                                                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${zipProgress}%` }} />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Archive className="w-4 h-4 mr-2" />
                                                📦 Descargar ZIP con {ordenesGeneradas.length} PDF(s) — Pedido {numeroPedido}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                        </>
                    )}
                </div>
            </div>

            {/* ── Modal Confirmación ───────────────────────────────────────── */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            Confirmar Generación de OC · Pedido {numeroPedido}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto py-2">
                        {requisicion.filter(r => (seleccionados.has("__ALL__") || seleccionados.has(r.terceroId)) && r.terceroId !== "__SIN_PROVEEDOR__").map((prov, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <p className="font-bold text-sm text-gray-800">{prov.terceroNombre}</p>
                                    <p className="text-xs text-gray-400">{prov.insumos.length} insumos · {prov.terceroCorreo}</p>
                                </div>
                                <p className="font-black text-[#183C30]">${prov.totalEstimado.toLocaleString("es-CO")}</p>
                            </div>
                        ))}
                        <div className="flex items-center justify-between p-3 bg-[#183C30] rounded-xl text-white">
                            <p className="font-bold">Total a comprometer</p>
                            <p className="font-black text-xl">${totalGeneral.toLocaleString("es-CO")}</p>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">Cancelar</Button>
                        <Button onClick={handleGenerar} disabled={generando} className="flex-1 bg-[#183C30] hover:bg-[#122e24] text-white font-bold">
                            {generando ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Generando...</> : "✅ Confirmar y Generar"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Modal Borradores ─────────────────────────────────────────── */}
            <Dialog open={showBorradores} onOpenChange={setShowBorradores}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderOpen className="w-5 h-5 text-violet-600" /> Borradores Guardados
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto py-2">
                        {borradores.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-6">No hay borradores guardados aún.</p>
                        )}
                        {borradores.map(b => (
                            <div key={b.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-violet-200 transition-all">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-gray-800 truncate">{b.nombre || "Sin nombre"}</p>
                                    <p className="text-xs text-gray-400">
                                        Pedido {b.numeroPedido || "—"} · {b.lineas?.length ?? 0} productos
                                        {b.updated_at && ` · ${format(new Date(b.updated_at), "dd/MM HH:mm", { locale: es })}`}
                                    </p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Button size="sm" variant="outline" onClick={() => handleCargarBorrador(b)} className="h-8 text-xs text-violet-700 border-violet-200 hover:bg-violet-50">
                                        Cargar
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => deleteBorrador(b.id)} className="h-8 w-8 p-0 text-red-400 hover:bg-red-50">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
