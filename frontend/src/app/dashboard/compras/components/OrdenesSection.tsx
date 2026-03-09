import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, ShoppingCart, CheckCircle, FileText, UploadCloud, Trash2, Package, Download, Edit2, X, Mail, Send, Loader2, PlusCircle, AtSign } from "lucide-react";
import { OrdenCompra, Tercero, Insumo } from "@/hooks/useCompras";
import { format } from "date-fns";
import { exportarOrdenPDF } from "../utils/pdfExport";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useEmail } from "@/hooks/useEmail";

interface OrdenesSectionProps {
    ordenes: OrdenCompra[];
    terceros: Tercero[];
    insumos: Insumo[];
    createOrden: (o: Partial<OrdenCompra>) => Promise<boolean>;
    updateOrden: (id: string, o: Partial<OrdenCompra>) => Promise<boolean>;
    deleteOrden: (id: string) => Promise<boolean>;
    setViewingOrden: (o: OrdenCompra) => void;
    setIsViewDialogOpen: (open: boolean) => void;
}

export const OrdenesSection = ({
    ordenes, terceros, insumos, createOrden, updateOrden, deleteOrden, setViewingOrden, setIsViewDialogOpen
}: OrdenesSectionProps) => {

    const [isOrdenDialogOpen, setIsOrdenDialogOpen] = useState(false);
    const [ordenForm, setOrdenForm] = useState<Partial<OrdenCompra>>({
        terceroId: "", insumoId: "", insumo: "", cantidad: 0, unidad: "Unidad", estado: "Pendiente", tiempoEntrega: "", fechaSolicitada: format(new Date(), 'yyyy-MM-dd'), numeroPedido: "", notas: "", entregasParciales: ""
    });
    const [orderItems, setOrderItems] = useState<Array<{ insumoId: string; cantidad: number; unidad: string; precio_estimado: number }>>([
        { insumoId: "", cantidad: 0, unidad: "Unidad", precio_estimado: 0 }
    ]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const { enviarOC, enviando } = useEmail();

    // Estado del modal de email
    const [emailModal, setEmailModal] = useState<{ open: boolean; orden: OrdenCompra | null }>({
        open: false, orden: null,
    });
    const [ccInput, setCcInput] = useState("");
    const [ccEmails, setCcEmails] = useState<string[]>([]);

    const addCC = () => {
        const trimmed = ccInput.trim();
        if (trimmed && !ccEmails.includes(trimmed)) {
            setCcEmails(prev => [...prev, trimmed]);
            setCcInput("");
        }
    };

    const openEmailModal = (orden: OrdenCompra) => {
        setCcEmails([]);
        setCcInput("");
        setEmailModal({ open: true, orden });
    };

    const handleEnviarEmail = async () => {
        if (!emailModal.orden) return;
        const tercero = terceros.find(t => t.id === emailModal.orden!.terceroId);
        if (!tercero) return;
        const ok = await enviarOC({ orden: emailModal.orden, tercero, insumos, ccEmails });
        if (ok) setEmailModal({ open: false, orden: null });
    };

    // Filters
    const [searchOrdenes, setSearchOrdenes] = useState("");
    const [filterProviderId, setFilterProviderId] = useState("");
    const [filterInsumoId, setFilterInsumoId] = useState("");
    const [filterPedidoNum, setFilterPedidoNum] = useState("");

    const handleSaveOrden = async () => {
        if (!ordenForm.terceroId) return;

        const validItems = orderItems.filter(it => it.insumoId && it.cantidad > 0);
        if (validItems.length === 0) return;

        const itemsToSave = validItems.map(it => {
            const ins = insumos.find(i => i.id === it.insumoId);
            return { ...it, insumo: ins?.nombre || "" };
        });

        const summaryLabel = itemsToSave.map(it => it.insumo).join(', ');

        const totalQty = itemsToSave.reduce((sum, i) => sum + i.cantidad, 0);
        const totalBruto = itemsToSave.reduce((sum, i) => sum + (i.cantidad * i.precio_estimado), 0);

        if (ordenForm.id) {
            await updateOrden(ordenForm.id, {
                ...ordenForm,
                items: itemsToSave,
                insumo: summaryLabel,
                cantidad: totalQty,
                total_bruto: totalBruto,
                precio_estimado: itemsToSave[0].precio_estimado
            });
        } else {
            let basePedido = (ordenForm.numeroPedido || "GEN").toString();
            basePedido = basePedido.replace(/\s+/g, '-').toUpperCase();

            const existingForPedido = ordenes.filter(o => {
                if (!o.id.includes('-')) return false;
                const parts = o.id.split('-');
                const prefix = parts.slice(0, -1).join('-');
                return prefix === basePedido;
            });
            let maxSeq = 0;
            existingForPedido.forEach(o => {
                const parts = o.id.split('-');
                const num = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(num) && num > maxSeq) maxSeq = num;
            });

            const newIdRow = `${basePedido}-${(maxSeq + 1).toString().padStart(3, '0')}`;

            await createOrden({
                ...ordenForm,
                id: newIdRow,
                items: itemsToSave,
                insumo: summaryLabel,
                cantidad: totalQty,
                total_bruto: totalBruto,
                precio_estimado: itemsToSave[0].precio_estimado,
                estado: "Pendiente"
            });
        }
        setOrdenForm({ terceroId: "", insumoId: "", insumo: "", cantidad: 0, unidad: "Unidad", estado: "Pendiente", tiempoEntrega: "", fechaSolicitada: format(new Date(), 'yyyy-MM-dd') });
        setOrderItems([{ insumoId: "", cantidad: 0, unidad: "Unidad", precio_estimado: 0 }]);
        setIsOrdenDialogOpen(false);
    };

    const editOrden = (o: OrdenCompra) => {
        setOrdenForm({ ...o });
        if (o.items && o.items.length > 0) {
            setOrderItems([...o.items]);
        } else {
            setOrderItems([{
                insumoId: o.insumoId || "",
                cantidad: o.cantidad,
                unidad: o.unidad,
                precio_estimado: o.precio_estimado || 0
            }]);
        }
        setIsOrdenDialogOpen(true);
    };

    const handleReceiveOrder = async (ordenId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingFile(true);

        try {
            const fileRef = ref(storage, `compras_recibos/${ordenId}_${file.name}`);
            const uploadTask = uploadBytesResumable(fileRef, file);

            uploadTask.on('state_changed',
                () => { },
                (err) => { console.error(err); setUploadingFile(false); },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    await updateOrden(ordenId, {
                        estado: "Recibido",
                        comprobanteUrl: downloadURL,
                        fechaMovimiento: new Date().toISOString()
                    });
                    setUploadingFile(false);
                }
            );
        } catch (err) {
            console.error(err);
            setUploadingFile(false);
        }
    };

    const handleExportPDF = async (o: OrdenCompra, tercero?: Tercero) => {
        if (!tercero) return;
        await exportarOrdenPDF(o, tercero, insumos);
    };

    const filteredOrdenes = useMemo(() => {
        return ordenes.filter(o => {
            const t = terceros.find(terc => terc.id === o.terceroId);
            const matchesSearch = o.insumo.toLowerCase().includes(searchOrdenes.toLowerCase()) ||
                o.estado.toLowerCase().includes(searchOrdenes.toLowerCase()) ||
                (t?.nombre || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
                (o.id || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
                (o.numeroPedido || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
                (o.notas || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
                (o.fechaSolicitada || "").toLowerCase().includes(searchOrdenes.toLowerCase());

            const matchesProvider = filterProviderId && filterProviderId !== "none" ? (t?.id === filterProviderId) : true;
            const matchesInsumo = filterInsumoId && filterInsumoId !== "none" ? (o.items?.some(it => it.insumoId === filterInsumoId) || o.insumoId === filterInsumoId) : true;
            const matchesPedidoNum = filterPedidoNum ? (o.numeroPedido === filterPedidoNum || o.id.includes(filterPedidoNum)) : true;

            return matchesSearch && matchesProvider && matchesInsumo && matchesPedidoNum;
        });
    }, [ordenes, searchOrdenes, terceros, filterProviderId, filterInsumoId, filterPedidoNum]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    Solicitudes y Órdenes
                </h2>
                <div className="flex w-full md:w-auto items-center gap-3">
                    <Input
                        className="max-w-xs bg-white rounded-xl shadow-sm border-gray-100 placeholder:text-gray-400"
                        placeholder="Buscar por Insumo o Estado..."
                        value={searchOrdenes}
                        onChange={(e) => setSearchOrdenes(e.target.value)}
                    />
                    <Dialog open={isOrdenDialogOpen} onOpenChange={setIsOrdenDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md" onClick={() => {
                                setOrdenForm({ terceroId: "", insumoId: "", insumo: "", cantidad: 0, unidad: "Unidad", estado: "Pendiente", tiempoEntrega: "", fechaSolicitada: format(new Date(), 'yyyy-MM-dd'), numeroPedido: "", notas: "", entregasParciales: "" });
                                setOrderItems([{ insumoId: "", cantidad: 0, unidad: "Unidad", precio_estimado: 0 }]);
                            }}>
                                <Plus className="w-4 h-4 mr-2" />
                                Nueva Orden
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{ordenForm.id ? `EDITAR ORDEN ${ordenForm.id}` : 'NUEVA ORDEN DE COMPRA ORIGEN BOTÁNICO'} - {format(new Date(), 'dd/MM/yyyy')}</DialogTitle>
                            </DialogHeader>
                            <div className="text-sm text-gray-600 mb-2 p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                                <div>
                                    <span className="font-bold">ZN E CENTRO LOGISTICO BG 16</span><br />
                                    Tel: (604) 2966310 | Rionegro - Colombia
                                </div>
                                <Building2 className="w-8 h-8 text-gray-300" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Proveedor Seleccionado</label>
                                        <Select value={ordenForm.terceroId} onValueChange={v => setOrdenForm({ ...ordenForm, terceroId: v })} disabled={!!ordenForm.id}>
                                            <SelectTrigger className="h-11 bg-white border-gray-200">
                                                <SelectValue placeholder="Seleccione proveedor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {terceros.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="space-y-1 flex-1">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">No. Pedido Interno</label>
                                            <Input className="h-11" value={ordenForm.numeroPedido || ''} onChange={e => setOrdenForm({ ...ordenForm, numeroPedido: e.target.value })} placeholder="Ej. 55" />
                                        </div>
                                        <div className="space-y-1 flex-1">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha Solicitada</label>
                                            <Input className="h-11" type="date" value={ordenForm.fechaSolicitada || ''} onChange={e => setOrdenForm({ ...ordenForm, fechaSolicitada: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tiempo de Entrega / Parciales</label>
                                        <div className="flex gap-2">
                                            <Input className="h-11 flex-1" value={ordenForm.tiempoEntrega} onChange={e => setOrdenForm({ ...ordenForm, tiempoEntrega: e.target.value })} placeholder="Ej. 3 días hábiles" />
                                            <Input className="h-11 flex-1" value={ordenForm.entregasParciales || ''} onChange={e => setOrdenForm({ ...ordenForm, entregasParciales: e.target.value })} placeholder="Fases de entrega" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Notas Adicionales</label>
                                        <Input className="h-11" value={ordenForm.notas || ''} onChange={e => setOrdenForm({ ...ordenForm, notas: e.target.value })} placeholder="Ej. Entregar en portería principal" />
                                    </div>
                                </div>

                                <div className="space-y-3 p-4 border rounded-xl bg-gray-50/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-gray-800 uppercase tracking-wider">Insumos del Pedido</label>
                                        {!ordenForm.id && (
                                            <Button variant="outline" size="sm" className="h-8 bg-white" onClick={() => setOrderItems([...orderItems, { insumoId: "", cantidad: 0, unidad: "Unidad", precio_estimado: 0 }])}>
                                                <Plus className="w-3 h-3 mr-1" /> Agregar
                                            </Button>
                                        )}
                                    </div>
                                    {orderItems.map((item, index) => (
                                        <div key={index} className="space-y-3 p-4 bg-white border border-gray-100 rounded-lg relative">
                                            {orderItems.length > 1 && (
                                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <div className="space-y-1 pr-6">
                                                <label className="text-xs font-semibold text-gray-600">Insumo / Producto a pedir</label>
                                                <Select value={item.insumoId} onValueChange={v => {
                                                    const selectedInsumo = insumos.find(i => i.id === v);
                                                    const provSelect = terceros.find(t => t.id === ordenForm.terceroId);
                                                    const precioProv = provSelect?.insumosPrecios?.find(ip => ip.insumoId === v)?.precio || selectedInsumo?.precio || 0;
                                                    const newItems = [...orderItems];
                                                    newItems[index] = { ...newItems[index], insumoId: v, unidad: selectedInsumo?.unidad || "Unidad", precio_estimado: precioProv };
                                                    setOrderItems(newItems);
                                                }} disabled={!ordenForm.terceroId}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={!ordenForm.terceroId ? "Seleccione proveedor primero" : "Seleccione Insumo"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {insumos.filter(i => {
                                                            if (!ordenForm.terceroId) return false;
                                                            const prov = terceros.find(t => t.id === ordenForm.terceroId);
                                                            if (!prov) return false;
                                                            return (prov.insumos || "").toLowerCase().includes(`[${i.sku.toLowerCase()}]`);
                                                        }).map(i => {
                                                            const prov = terceros.find(t => t.id === ordenForm.terceroId);
                                                            const currentPx = prov?.insumosPrecios?.find(ip => ip.insumoId === i.id)?.precio;
                                                            if (currentPx !== undefined) {
                                                                return (
                                                                    <SelectItem key={i.id} value={i.id} className="text-indigo-700 font-medium bg-indigo-50/30">
                                                                        ★ {i.sku} - {i.nombre} (${currentPx.toLocaleString()})
                                                                    </SelectItem>
                                                                );
                                                            }
                                                            return (
                                                                <SelectItem key={i.id} value={i.id}>{i.sku} - {i.nombre}</SelectItem>
                                                            )
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-12 gap-3">
                                                <div className="col-span-4 space-y-1">
                                                    <label className="text-xs font-semibold text-gray-600">Val. Unitario ($)</label>
                                                    <Input className="h-10" type="number" value={item.precio_estimado || ''} onChange={e => {
                                                        const newItems = [...orderItems];
                                                        newItems[index].precio_estimado = Number(e.target.value);
                                                        setOrderItems(newItems);
                                                    }} />
                                                </div>
                                                <div className="col-span-4 space-y-1">
                                                    <label className="text-xs font-semibold text-gray-600">Cantidad</label>
                                                    <Input className="h-10" type="number" value={item.cantidad || ''} onChange={e => {
                                                        const newItems = [...orderItems];
                                                        newItems[index].cantidad = Number(e.target.value);
                                                        setOrderItems(newItems);
                                                    }} />
                                                </div>
                                                <div className="col-span-4 space-y-1">
                                                    <label className="text-xs font-semibold text-gray-600">Und.</label>
                                                    <Select value={item.unidad} onValueChange={v => {
                                                        const newItems = [...orderItems];
                                                        newItems[index].unidad = v;
                                                        setOrderItems(newItems);
                                                    }}>
                                                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Unidad">Und</SelectItem>
                                                            <SelectItem value="Kilogramo">Kg</SelectItem>
                                                            <SelectItem value="Litro">Lt</SelectItem>
                                                            <SelectItem value="Caja">Caja</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 border-t pt-4">
                                <Button onClick={handleSaveOrden} className="w-full bg-[#183C30] hover:bg-[#122e24] h-12 text-lg font-bold">
                                    {ordenForm.id ? "Actualizar Orden" : "Generar Orden de Compra"}
                                </Button>
                                <p className="text-[11px] text-center text-gray-500">
                                    Al {ordenForm.id ? 'actualizar' : 'generar'} esta orden, se notificará al sistema de inventarios y proveedores correspondientes.
                                </p>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Fila de Filtros Avanzados */}
            <div className="flex flex-wrap gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-2">
                <div className="flex-1 min-w-[200px] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <Select value={filterProviderId} onValueChange={setFilterProviderId}>
                        <SelectTrigger className="bg-slate-50 border-gray-100">
                            <SelectValue placeholder="Filtrar por Proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Todos los proveedores</SelectItem>
                            {terceros.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 min-w-[200px] flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    <Select value={filterInsumoId} onValueChange={setFilterInsumoId}>
                        <SelectTrigger className="bg-slate-50 border-gray-100">
                            <SelectValue placeholder="Filtrar por Insumo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Todos los insumos</SelectItem>
                            {insumos.map(i => <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-40 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <Input
                        className="bg-slate-50 border-gray-100"
                        placeholder="No. Pedido / ID"
                        value={filterPedidoNum}
                        onChange={e => setFilterPedidoNum(e.target.value)}
                    />
                </div>
                {(filterProviderId || filterInsumoId || filterPedidoNum) && (
                    <Button variant="ghost" onClick={() => { setFilterProviderId(""); setFilterInsumoId(""); setFilterPedidoNum(""); }} className="text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4 mr-2" /> Limpiar
                    </Button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] p-4 bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                    <div>Ítems / Detalle</div>
                    <div>Proveedor</div>
                    <div className="text-center">Cant. Total</div>
                    <div className="text-center">Total Bruto</div>
                    <div className="text-center">Estado</div>
                    <div className="w-[180px] text-center">Acciones</div>
                </div>
                <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                    {filteredOrdenes.map(o => {
                        const tercero = terceros.find(t => t.id === o.terceroId);
                        const isRecibido = o.estado === "Recibido";
                        return (
                            <div key={o.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] p-4 items-center hover:bg-slate-50 transition-colors border-b last:border-0">
                                <div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-[#183C30] text-[15px] flex items-center gap-2">
                                            <ShoppingCart className="w-4 h-4" />
                                            Orden {o.numeroPedido || o.id}
                                        </p>
                                        <p className="text-[12px] text-gray-600 leading-relaxed max-w-md">
                                            Esta es la OC <span className="font-bold text-gray-800">{o.id}</span> del proveedor <span className="font-bold text-gray-800">{tercero?.nombre}</span> por un total de <span className="font-bold text-teal-700">${(o.total_bruto || (o.cantidad * (o.precio_estimado || 0))).toLocaleString()}</span>.
                                            <span className="block text-gray-400 mt-0.5 italic">Si desea ver el detalle de los productos, presione el botón de visualizar.</span>
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 items-center mt-3">
                                        <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-mono border border-gray-200">
                                            REF: {o.id}
                                        </span>
                                        {o.numeroPedido && <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 uppercase">Pedido: {o.numeroPedido}</span>}
                                        {o.created_at && <p className="text-[10px] text-gray-400">📅 {format(new Date(o.created_at), 'dd/MM/yyyy')}</p>}
                                    </div>
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium text-gray-700 truncate">{tercero?.nombre || "Desconocido"}</p>
                                    <p className="text-[10px] text-gray-500">NIT/CC: {tercero?.nit}</p>
                                </div>
                                <div className="text-center font-bold text-gray-700 text-sm">
                                    {o.items ? o.items.reduce((sum, i) => sum + i.cantidad, 0) : o.cantidad}
                                </div>
                                <div className="text-center font-bold text-teal-700 text-sm">
                                    ${(o.total_bruto || ((o.precio_estimado || 0) * o.cantidad)).toLocaleString()}
                                </div>
                                <div className="flex justify-center">
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 w-max ${o.estado === "Recibido" ? 'bg-green-100 text-green-700' :
                                        o.estado === "Parcial" ? 'bg-blue-100 text-blue-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                        {o.estado === "Recibido" ? <CheckCircle className="w-3 h-3" /> :
                                            o.estado === "Parcial" ? <Package className="w-3 h-3" /> :
                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                        {o.estado}
                                    </span>
                                </div>
                                <div className="w-[180px] flex justify-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => { setViewingOrden(o); setIsViewDialogOpen(true); }} className="text-teal-600 hover:bg-teal-50 h-8 w-8" title="Visualizar Orden">
                                        <FileText className="w-4 h-4" />
                                    </Button>
                                    {!isRecibido ? (
                                        <>
                                            <Button variant="ghost" size="icon" onClick={() => editOrden(o)} className="text-blue-500 hover:bg-blue-50 h-8 w-8" title="Editar Orden">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <div className="relative">
                                                <Input
                                                    type="file"
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    onChange={(e) => handleReceiveOrder(o.id, e)}
                                                    disabled={uploadingFile}
                                                    accept="image/*,.pdf"
                                                />
                                                <Button variant="ghost" size="icon" className="text-emerald-500 hover:bg-emerald-50 h-8 w-8" disabled={uploadingFile}>
                                                    <UploadCloud className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <Button variant="ghost" size="icon" onClick={() => o.comprobanteUrl && window.open(o.comprobanteUrl)} className="text-teal-500 hover:bg-teal-50 h-8 w-8" title="Ver Comprobante">
                                            <FileText className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => handleExportPDF(o, tercero)} className="text-amber-600 hover:bg-amber-50 h-8 w-8" title="Descargar PDF">
                                        <Download className="w-4 h-4" />
                                    </Button>
                                    {/* Botón Enviar por Email --- aparece si hay correo en el proveedor */}
                                    {tercero?.correo && (
                                        <Button variant="ghost" size="icon" onClick={() => openEmailModal(o)}
                                            className="text-blue-500 hover:bg-blue-50 h-8 w-8" title="Enviar OC por email al proveedor">
                                            <Mail className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => deleteOrden(o.id)} className="text-red-500 hover:bg-red-50 h-8 w-8" title="Eliminar Orden">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                    {filteredOrdenes.length === 0 && (
                        <div className="p-10 text-center text-gray-500">
                            No hay órdenes de compra que coincidan con la búsqueda.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal email */}
            <EmailModal
                open={emailModal.open}
                onClose={() => setEmailModal({ open: false, orden: null })}
                orden={emailModal.orden}
                terceros={terceros}
                onEnviar={handleEnviarEmail}
                enviando={enviando}
                ccEmails={ccEmails}
                setCcEmails={setCcEmails}
                ccInput={ccInput}
                setCcInput={setCcInput}
                addCC={addCC}
            />
        </div>
    );
};

/* ── Modal de envío de email ─────────────────────────────────────────────── */
function EmailModal({
    open, onClose, orden, terceros, onEnviar, enviando,
    ccEmails, setCcEmails, ccInput, setCcInput, addCC,
}: {
    open: boolean;
    onClose: () => void;
    orden: OrdenCompra | null;
    terceros: Tercero[];
    onEnviar: () => void;
    enviando: boolean;
    ccEmails: string[];
    setCcEmails: (v: string[]) => void;
    ccInput: string;
    setCcInput: (v: string) => void;
    addCC: () => void;
}) {
    if (!orden) return null;
    const tercero = terceros.find(t => t.id === orden.terceroId);
    const total = orden.total_bruto ?? ((orden.cantidad ?? 0) * (orden.precio_estimado ?? 0));

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[540px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black">
                        <Mail className="w-5 h-5 text-blue-500" />
                        Enviar OC por Email
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Info OC */}
                    <div className="bg-[#183C30]/5 border border-[#183C30]/20 rounded-xl p-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Orden de Compra</p>
                                <p className="font-black text-gray-900 text-lg">{orden.id}</p>
                                <p className="text-xs text-gray-500">Pedido: {orden.numeroPedido ?? "—"}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Total</p>
                                <p className="font-black text-teal-700 text-xl">${total.toLocaleString("es-CO")}</p>
                                <p className="text-[10px] text-gray-400">{(orden.items?.length ?? 1)} ítem(s)</p>
                            </div>
                        </div>
                    </div>

                    {/* Para */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            <AtSign className="w-3 h-3" /> Para (Proveedor)
                        </label>
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                <Building2 className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 text-sm">{tercero?.nombre ?? "Proveedor"}</p>
                                <p className="text-xs text-blue-600 font-mono">{tercero?.correo ?? "Sin correo configurado"}</p>
                            </div>
                        </div>
                        {!tercero?.correo && (
                            <p className="text-xs text-red-500">⚠ Este proveedor no tiene correo. Agrégalo en la pestaña Terceros.</p>
                        )}
                    </div>

                    {/* CC */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Copia (CC) — Otros destinatarios
                        </label>
                        <div className="flex gap-2">
                            <Input placeholder="correo@empresa.com" value={ccInput}
                                onChange={e => setCcInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && addCC()}
                                className="h-9 text-sm flex-1" />
                            <Button size="sm" variant="outline" onClick={addCC} className="shrink-0">
                                <PlusCircle className="w-4 h-4 mr-1" /> Agregar
                            </Button>
                        </div>
                        {ccEmails.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {ccEmails.map(email => (
                                    <span key={email} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                                        {email}
                                        <button onClick={() => setCcEmails(ccEmails.filter(e => e !== email))}>
                                            <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info adjunto */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <span>Se adjuntará el PDF <strong>OC_{orden.id}.pdf</strong> generado automáticamente.</span>
                    </div>

                    {/* Botón Enviar */}
                    <Button onClick={onEnviar} disabled={enviando || !tercero?.correo}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-base">
                        {enviando ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                        ) : (
                            <><Send className="w-4 h-4 mr-2" /> Enviar OC a {1 + ccEmails.length} destinatario(s)</>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
