import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, FileText, Package, Download, ShoppingCart, CheckCircle2, History, AlertCircle, X, Truck, UserCheck, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { OrdenCompra, Tercero, Insumo, Delivery, DeliveryItem } from "@/hooks/useCompras";
import { exportarOrdenPDF } from "../utils/pdfExport";

interface VisualizeOrdenDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    viewingOrden: OrdenCompra | null;
    terceros: Tercero[];
    insumos: Insumo[];
    updateOrden: (id: string, updates: Partial<OrdenCompra>) => Promise<boolean>;
}

export const VisualizeOrdenDialog = ({
    open,
    onOpenChange,
    viewingOrden,
    terceros,
    insumos,
    updateOrden
}: VisualizeOrdenDialogProps) => {
    const [isReceiving, setIsReceiving] = useState(false);
    const [receivedInputs, setReceivedInputs] = useState<Record<number, number>>({});
    const [receiverName, setReceiverName] = useState("");
    const [deliveryNotes, setDeliveryNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (viewingOrden) {
            const initial: Record<number, number> = {};
            viewingOrden.items?.forEach((_, idx) => {
                initial[idx] = 0;
            });
            setReceivedInputs(initial);
            setIsReceiving(false);
        }
    }, [viewingOrden]);

    if (!viewingOrden) return null;

    const currentTercero = terceros.find(t => t.id === viewingOrden.terceroId);

    const handleSaveReception = async () => {
        if (!viewingOrden.items) return;
        if (!receiverName.trim()) {
            alert("Por favor ingrese quién recibe el pedido");
            return;
        }
        setIsSaving(true);

        const newDeliveryItems: DeliveryItem[] = [];
        const updatedItems = viewingOrden.items.map((it, idx) => {
            const entHoy = receivedInputs[idx] || 0;
            if (entHoy > 0) {
                newDeliveryItems.push({
                    insumoId: it.insumoId,
                    insumo: it.insumo,
                    cantidad: entHoy
                });
            }
            return {
                ...it,
                cantidad_recibida: (it.cantidad_recibida || 0) + entHoy
            };
        });

        if (newDeliveryItems.length === 0) {
            alert("No ha ingresado cantidades para recibir");
            setIsSaving(false);
            return;
        }

        const newDelivery: Delivery = {
            id: crypto.randomUUID(),
            fecha: new Date().toISOString(),
            recibidoPor: receiverName,
            items: newDeliveryItems,
            notas: deliveryNotes
        };

        const historialEntregas = [...(viewingOrden.historialEntregas || []), newDelivery];

        // Clasificar nuevo estado
        const allDone = updatedItems.every(it => (it.cantidad_recibida || 0) >= it.cantidad);
        const someDone = updatedItems.some(it => (it.cantidad_recibida || 0) > 0);

        let nuevoEstado = viewingOrden.estado;
        if (allDone) nuevoEstado = 'Recibido';
        else if (someDone) nuevoEstado = 'Parcial';

        const success = await updateOrden(viewingOrden.id, {
            items: updatedItems,
            historialEntregas,
            estado: nuevoEstado
        });

        if (success) {
            setIsReceiving(false);
            setReceivedInputs({});
            setReceiverName("");
            setDeliveryNotes("");
        }
        setIsSaving(false);
    };

    const calculateOverallProgress = () => {
        if (!viewingOrden.items || viewingOrden.items.length === 0) return 0;
        const totalRequested = viewingOrden.items.reduce((acc, it) => acc + it.cantidad, 0);
        const totalReceived = viewingOrden.items.reduce((acc, it) => acc + (it.cantidad_recibida || 0), 0);
        return Math.round((totalReceived / totalRequested) * 100);
    };

    const progress = calculateOverallProgress();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[100vw] w-screen h-screen max-h-screen m-0 p-0 border-none shadow-none rounded-none overflow-y-auto transition-all duration-300">
                <div className="bg-white flex flex-col min-h-screen w-full">
                    {/* Header estilizado */}
                    <div className="bg-[#0f172a] p-10 text-white flex justify-between items-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
                        <div className="flex items-center gap-8 relative z-10">
                            <div className="flex-shrink-0 bg-white p-4 rounded-2xl shadow-2xl">
                                <img
                                    src="/logo.png"
                                    alt="Logo"
                                    className="w-16 h-16 object-contain"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                    }}
                                />
                                <div className="w-16 h-16 items-center justify-center font-black text-2xl text-slate-800 hidden">OB</div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-4xl font-black tracking-tight uppercase leading-none">Orden de Compra</h2>
                                    <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded text-[10px] font-black tracking-[0.2em] border border-emerald-500/30">OFICIAL</span>
                                </div>
                                <p className="text-slate-400 font-bold tracking-[0.2em] text-sm uppercase">Origen Botánico S.A.S</p>
                                <div className="flex items-center gap-4 mt-4 text-slate-400 text-xs font-black uppercase">
                                    <span className="bg-white/5 px-4 py-1.5 rounded-full border border-white/5 tracking-[0.2em]">ID: {viewingOrden.id.slice(0, 8)}...</span>
                                    <span className="bg-emerald-500/10 text-emerald-100 px-4 py-1.5 rounded-full border border-emerald-500/20 tracking-[0.2em]">Pedido: {viewingOrden.numeroPedido || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-4 relative z-10">
                            <div className="flex flex-col items-end gap-2">
                                <div className="text-[10px] font-black uppercase tracking-[0.3em] mb-1 opacity-40">Estado de Suministro</div>
                                <div className="flex items-center gap-3">
                                    <span className={`px-6 py-2 rounded-xl text-sm font-black shadow-2xl uppercase tracking-[0.2em] ${viewingOrden.estado === 'Recibido' ? 'bg-emerald-500 text-white' :
                                        viewingOrden.estado === 'Parcial' ? 'bg-blue-500 text-white' :
                                            'bg-amber-400 text-slate-900'
                                        }`}>
                                        {viewingOrden.estado}
                                    </span>
                                    {progress > 0 && (
                                        <div className="flex flex-col items-end">
                                            <span className="text-2xl font-black text-white">{progress}%</span>
                                            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Generada el {viewingOrden.created_at ? format(new Date(viewingOrden.created_at), "d 'de' MMMM, yyyy", { locale: es }) : 'N/A'}</p>
                        </div>
                    </div>

                    <div className="p-12 space-y-12 max-w-[1600px] mx-auto w-full">
                        <div className="grid grid-cols-3 gap-16">
                            {/* PANEL IZQUIERDO: Proveedor */}
                            <div className="space-y-6">
                                <h3 className="flex items-center gap-3 font-black text-[#183C30] uppercase text-sm tracking-[0.3em] border-b-2 border-emerald-100 pb-3">
                                    <Building2 className="w-6 h-6" /> Información del Proveedor
                                </h3>
                                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 space-y-6 shadow-sm">
                                    <div className="grid grid-cols-3 gap-4">
                                        <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">Razón Social</span>
                                        <span className="col-span-2 font-black text-slate-800 text-2xl leading-tight">{currentTercero?.nombre || 'Desconocido'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">NIT / Documento</span>
                                        <span className="col-span-2 font-mono font-bold text-slate-600 bg-white px-4 py-1.5 rounded-lg border border-slate-200 inline-block text-base shadow-sm">{currentTercero?.nit || 'N/A'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 border-t pt-6 border-slate-200/50">
                                        <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">Contacto Directo</span>
                                        <div className="col-span-2 flex flex-col gap-1">
                                            <span className="font-black text-slate-700 text-lg uppercase">{currentTercero?.personaContacto || 'N/A'}</span>
                                            <span className="text-base font-bold text-emerald-600">{currentTercero?.numeroContacto || 'N/A'}</span>
                                            <span className="text-sm font-medium text-slate-400 italic">{currentTercero?.correo || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* PANEL CENTRAL: Logística */}
                            <div className="space-y-6">
                                <h3 className="flex items-center gap-3 font-black text-[#183C30] uppercase text-sm tracking-[0.3em] border-b-2 border-emerald-100 pb-3">
                                    <FileText className="w-6 h-6" /> Detalles de Operación
                                </h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-2">
                                        <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">Fecha Compromiso</span>
                                        <p className="font-black text-slate-900 text-2xl">{viewingOrden.fechaSolicitada ? format(parseISO(viewingOrden.fechaSolicitada), 'dd/MM/yyyy') : 'POR DEFINIR'}</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-2">
                                        <span className="text-slate-400 text-[11px] font-black uppercase tracking-widest">Lead Time</span>
                                        <p className="font-black text-emerald-700 text-2xl uppercase">{viewingOrden.tiempoEntrega || 'INMEDIATO'}</p>
                                    </div>
                                    <div className="col-span-2 bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex items-center justify-between">
                                        <div>
                                            <span className="text-emerald-700 text-[11px] font-black uppercase tracking-widest">Plan de Entregas</span>
                                            <p className="text-lg text-emerald-900 font-bold">{(viewingOrden as any).entregasParciales || 'Entrega Única'}</p>
                                        </div>
                                        <Package className="w-10 h-10 text-emerald-400/50" />
                                    </div>
                                </div>
                            </div>

                            {/* PANEL DERECHO: Acciones de Recepción */}
                            <div className="space-y-6">
                                <h3 className="flex items-center gap-3 font-black text-[#183C30] uppercase text-sm tracking-[0.3em] border-b-2 border-emerald-100 pb-3">
                                    <Truck className="w-6 h-6" /> Control de Entregas
                                </h3>
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-4">
                                    {!isReceiving ? (
                                        <>
                                            <Button
                                                onClick={() => setIsReceiving(true)}
                                                className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-200 transition-all active:scale-95"
                                            >
                                                <Package className="w-6 h-6" /> Registrar Entrega
                                            </Button>
                                            <Button
                                                onClick={() => currentTercero && exportarOrdenPDF(viewingOrden, currentTercero, insumos)}
                                                variant="outline"
                                                className="w-full h-16 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3"
                                            >
                                                <Download className="w-6 h-6" /> Exportar PDF
                                            </Button>
                                        </>
                                    ) : (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                            <div className="space-y-4">
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Quién Recibe</label>
                                                    <div className="relative">
                                                        <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                        <Input
                                                            placeholder="Nombre completo"
                                                            value={receiverName}
                                                            onChange={(e) => setReceiverName(e.target.value)}
                                                            className="pl-12 h-12 bg-slate-50 border-slate-200 rounded-xl font-bold focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Notas de Entrega</label>
                                                    <Input
                                                        placeholder="Ej: Llegó con avería ligera..."
                                                        value={deliveryNotes}
                                                        onChange={(e) => setDeliveryNotes(e.target.value)}
                                                        className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                                <p className="text-[10px] font-black text-amber-800 uppercase leading-snug">Modo Recepción: Ajuste las cantidades en la tabla inferior y confirme.</p>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <Button
                                                    onClick={handleSaveReception}
                                                    disabled={isSaving}
                                                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-emerald-100 disabled:opacity-50"
                                                >
                                                    {isSaving ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            Guardando...
                                                        </div>
                                                    ) : "Confirmar Recepción"}
                                                </Button>
                                                <Button
                                                    onClick={() => setIsReceiving(false)}
                                                    variant="ghost"
                                                    className="w-full font-black text-slate-400 hover:text-red-500 uppercase text-[10px]"
                                                >
                                                    Descartar Cambios
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* TABLA DE PRODUCTOS - AMPLIA */}
                        <div className="space-y-6">
                            <h3 className="flex items-center gap-3 font-black text-[#183C30] uppercase text-sm tracking-[0.3em] border-b-2 border-emerald-100 pb-3">
                                <ShoppingCart className="w-6 h-6" /> Detalle de Ítems e Inventario Recibido
                            </h3>
                            <div className="border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 bg-white">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-900 border-b-2 border-slate-950">
                                            <th className="px-8 py-6 text-center w-20 text-slate-400 font-black uppercase text-[10px] tracking-widest">Ref</th>
                                            <th className="px-8 py-6 text-left text-slate-400 font-black uppercase text-[10px] tracking-widest">Insumo / Descripción</th>
                                            <th className="px-8 py-6 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest">Cantidad Pedida</th>
                                            <th className="px-8 py-6 text-center text-blue-400 font-black uppercase text-[10px] tracking-widest bg-blue-500/5">Acumulado Recibido</th>
                                            {isReceiving && <th className="px-8 py-6 text-center text-emerald-400 font-black uppercase text-[10px] tracking-widest animate-pulse bg-emerald-500/5">Novedad Hoy</th>}
                                            <th className="px-8 py-6 text-center text-amber-400 font-black uppercase text-[10px] tracking-widest">Saldo Pendiente</th>
                                            <th className="px-8 py-6 text-right text-slate-400 font-black uppercase text-[10px] tracking-widest">Costo Proyectado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(viewingOrden.items && viewingOrden.items.length > 0) ? (
                                            viewingOrden.items.map((it, idx) => {
                                                const qtyRec = it.cantidad_recibida || 0;
                                                const entHoy = receivedInputs[idx] || 0;
                                                const pend = Math.max(0, it.cantidad - qtyRec - (isReceiving ? entHoy : 0));

                                                return (
                                                    <tr key={idx} className="group hover:bg-emerald-50/30 transition-all duration-300">
                                                        <td className="px-8 py-6 text-slate-300 font-mono text-center font-bold text-lg">{idx + 1}</td>
                                                        <td className="px-8 py-6 font-black text-slate-800 text-xl uppercase tracking-tight">{it.insumo}</td>
                                                        <td className="px-8 py-6 text-center">
                                                            <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-black text-sm border border-slate-200">
                                                                {it.cantidad.toLocaleString()} {it.unidad}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-6 text-center bg-blue-50/30">
                                                            <span className="text-blue-700 font-black text-lg">
                                                                {qtyRec.toLocaleString()}
                                                            </span>
                                                        </td>
                                                        {isReceiving && (
                                                            <td className="px-8 py-6 text-center bg-emerald-50">
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    max={it.cantidad - qtyRec}
                                                                    value={entHoy}
                                                                    onChange={(e) => setReceivedInputs({ ...receivedInputs, [idx]: Number(e.target.value) })}
                                                                    className="w-24 mx-auto text-center font-black text-emerald-700 border-2 border-emerald-200 focus:ring-emerald-500 rounded-xl bg-white"
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="px-8 py-6 text-center">
                                                            <span className={`font-black text-lg ${pend > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                                {pend.toLocaleString()}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-6 text-right font-black text-emerald-700 text-2xl border-l border-slate-100 bg-emerald-50/20">
                                                            ${((it.cantidad || 0) * (it.precio_estimado || 0)).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr className="group hover:bg-emerald-50/30 transition-all duration-300">
                                                <td className="px-8 py-6 text-slate-300 font-mono text-center font-bold text-lg">1</td>
                                                <td className="px-8 py-6 font-black text-slate-800 text-xl uppercase tracking-tight">{viewingOrden.insumo.replace(/ \+\d+ más$/, "")}</td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-black text-sm border border-slate-200">
                                                        {viewingOrden.cantidad.toLocaleString()} {viewingOrden.unidad}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-center bg-blue-50/30">
                                                    <span className="text-blue-700 font-black text-lg">0</span>
                                                </td>
                                                {isReceiving && <td className="px-8 py-6 text-center bg-emerald-50">-</td>}
                                                <td className="px-8 py-6 text-center">
                                                    <span className="text-amber-600 font-black text-lg">{viewingOrden.cantidad.toLocaleString()}</span>
                                                </td>
                                                <td className="px-8 py-6 text-right font-black text-emerald-700 text-2xl border-l border-slate-100 bg-emerald-50/20">
                                                    ${(viewingOrden.cantidad * (viewingOrden.precio_estimado || 0)).toLocaleString()}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-12">
                            {/* HISTORIAL DE ENTREGAS */}
                            <div className="space-y-6">
                                <h3 className="flex items-center gap-3 font-black text-[#183C30] uppercase text-sm tracking-[0.3em] border-b-2 border-emerald-100 pb-3">
                                    <History className="w-6 h-6" /> Registro Histórico de Entregas
                                </h3>

                                <div className="space-y-4">
                                    {viewingOrden.historialEntregas && viewingOrden.historialEntregas.length > 0 ? (
                                        viewingOrden.historialEntregas.slice().reverse().map((delivery, dIdx) => (
                                            <div key={delivery.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-emerald-100 p-2 rounded-lg">
                                                            <Calendar className="w-4 h-4 text-emerald-700" />
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-900 leading-none">{format(new Date(delivery.fecha), "d 'de' MMMM, HH:mm", { locale: es })}</p>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">N° {viewingOrden.historialEntregas!.length - dIdx}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Recibido por</span>
                                                        <span className="font-black text-emerald-700">{delivery.recibidoPor}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50 rounded-xl p-4 mb-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        {delivery.items.map((item, iIdx) => (
                                                            <span key={iIdx} className="bg-white border border-slate-200 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold">
                                                                {item.insumo}: <span className="text-emerald-600 font-black">{item.cantidad}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {delivery.notas && (
                                                    <p className="text-sm text-slate-500 italic font-medium px-2 border-l-2 border-slate-200">
                                                        "{delivery.notas}"
                                                    </p>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                                            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No hay registros de entrega parcial</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* OBSERVACIONES Y TOTALES */}
                            <div className="space-y-8">
                                {viewingOrden.notas && (
                                    <div className="space-y-6">
                                        <h3 className="flex items-center gap-3 font-black text-[#183C30] uppercase text-sm tracking-[0.3em] border-b-2 border-emerald-100 pb-3">
                                            <FileText className="w-6 h-6" /> Notas de la Orden
                                        </h3>
                                        <div className="bg-amber-50/80 rounded-3xl p-8 border border-amber-100 flex gap-6 items-start shadow-sm">
                                            <p className="text-amber-900 leading-relaxed font-bold italic text-lg opacity-80">"{viewingOrden.notas}"</p>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-[#0f172a] rounded-[2rem] p-10 text-white space-y-6 shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                                    <div className="flex justify-between items-center border-b border-white/10 pb-6 uppercase tracking-[0.2em] text-[10px] font-black opacity-60">
                                        <span>Resumen Económico</span>
                                        <span>Valores en COP</span>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 font-bold">Total Bruto</span>
                                            <span className="text-2xl font-black">${(viewingOrden.total_bruto || (viewingOrden.cantidad * (viewingOrden.precio_estimado || 0))).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 font-bold">Retenciones / Impuestos</span>
                                            <span className="text-slate-400 font-black">$0</span>
                                        </div>
                                        <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-emerald-400 font-black text-xs uppercase tracking-widest">Valor Neto a Pagar</span>
                                                <span className="text-4xl font-black text-white mt-1">
                                                    ${(viewingOrden.total_bruto || (viewingOrden.cantidad * (viewingOrden.precio_estimado || 0))).toLocaleString()}
                                                </span>
                                            </div>
                                            <CheckCircle2 className="w-12 h-12 text-emerald-500/20" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Botón de cierre discreto */}
                        <div className="flex justify-center pb-12">
                            <Button variant="ghost" onClick={() => onOpenChange(false)} className="px-12 py-8 font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">
                                <X className="w-6 h-6 mr-3" /> Cerrar Documento
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
