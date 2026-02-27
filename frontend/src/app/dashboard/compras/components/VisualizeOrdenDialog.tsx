import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, FileText, Package, Download, ShoppingCart, CheckCircle2, History, AlertCircle, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { OrdenCompra, Tercero, Insumo } from "@/hooks/useCompras";
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
        setIsSaving(true);

        const updatedItems = viewingOrden.items.map((it, idx) => ({
            ...it,
            cantidad_recibida: (it.cantidad_recibida || 0) + (receivedInputs[idx] || 0)
        }));

        // Clasificar nuevo estado
        const allDone = updatedItems.every(it => (it.cantidad_recibida || 0) >= it.cantidad);
        const someDone = updatedItems.some(it => (it.cantidad_recibida || 0) > 0);

        let nuevoEstado = viewingOrden.estado;
        if (allDone) nuevoEstado = 'Recibido';
        else if (someDone) nuevoEstado = 'Parcial';

        const success = await updateOrden(viewingOrden.id, {
            items: updatedItems,
            estado: nuevoEstado
        });

        if (success) {
            setIsReceiving(false);
        }
        setIsSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] m-0 p-0 border-none shadow-none rounded-none overflow-hidden transition-all duration-300">
                <div className="bg-white overflow-y-auto flex flex-col h-full w-full">
                    {/* Header estilizado */}
                    <div className="bg-[#183C30] p-10 text-white flex justify-between items-center relative border-b-8 border-emerald-900">
                        <div className="flex items-center gap-8">
                            <div className="bg-white p-4 rounded-3xl shadow-2xl flex-shrink-0 border-4 border-emerald-800/30">
                                <img
                                    src="/logo.png"
                                    alt="Logo Origen Botánico"
                                    className="w-24 h-24 object-contain"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                    }}
                                />
                                <div className="w-24 h-24 items-center justify-center bg-[#183C30] rounded-xl font-black text-4xl text-white hidden">G</div>
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-4xl font-black tracking-tight uppercase leading-none">Autorización de Compra</h2>
                                <p className="text-emerald-400 font-bold tracking-[0.2em] text-sm uppercase">Origen Botánico S.A.S. - NIT: 901.401.558-1</p>
                                <div className="flex items-center gap-4 mt-4 text-emerald-100/80 text-xs font-black uppercase">
                                    <span className="bg-white/10 px-4 py-1.5 rounded-full border border-white/10 tracking-[0.2em]">ID: {viewingOrden.id}</span>
                                    <span className="bg-white/10 px-4 py-1.5 rounded-full border border-white/10 tracking-[0.2em]">Pedido: {viewingOrden.numeroPedido || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                            <div>
                                <div className="text-[10px] font-black underline decoration-emerald-500 underline-offset-4 uppercase tracking-[0.3em] mb-2 opacity-60">Estado Actual</div>
                                <span className={`px-6 py-2 rounded-xl text-sm font-black shadow-2xl uppercase tracking-[0.2em] ${viewingOrden.estado === 'Recibido' ? 'bg-emerald-500 text-white' :
                                    viewingOrden.estado === 'Parcial' ? 'bg-blue-500 text-white' :
                                        'bg-amber-400 text-[#183C30]'
                                    }`}>
                                    {viewingOrden.estado}
                                </span>
                            </div>
                            <p className="text-[10px] font-bold text-emerald-100/40 uppercase tracking-widest">Generada: {viewingOrden.created_at ? format(new Date(viewingOrden.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
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
                                    <CheckCircle2 className="w-6 h-6" /> Registro de Inventario
                                </h3>
                                <div className="bg-white p-8 rounded-3xl border border-dotted border-slate-300 shadow-xl space-y-4">
                                    {!isReceiving ? (
                                        <>
                                            <Button
                                                onClick={() => setIsReceiving(true)}
                                                className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-200"
                                            >
                                                <History className="w-6 h-6" /> Recibir Pedido
                                            </Button>
                                            <Button
                                                onClick={() => currentTercero && exportarOrdenPDF(viewingOrden, currentTercero, insumos)}
                                                variant="outline"
                                                className="w-full h-16 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3"
                                            >
                                                <Download className="w-6 h-6" /> Descargar PDF
                                            </Button>
                                        </>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                                <p className="text-[10px] font-black text-amber-800 uppercase leading-snug">Modo Recepción: Ingrese las cantidades que están entrando a la bodega hoy.</p>
                                            </div>
                                            <Button
                                                onClick={handleSaveReception}
                                                disabled={isSaving}
                                                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest"
                                            >
                                                {isSaving ? "Guardando..." : "Confirmar Entrada"}
                                            </Button>
                                            <Button
                                                onClick={() => setIsReceiving(false)}
                                                variant="ghost"
                                                className="w-full font-black text-slate-400 hover:text-red-500 uppercase text-[10px]"
                                            >
                                                Cancelar
                                            </Button>
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
                                        <tr className="bg-[#183C30] border-b-2 border-emerald-900">
                                            <th className="px-8 py-6 text-center w-20 text-emerald-100/60 font-black uppercase text-[10px] tracking-widest">Item</th>
                                            <th className="px-8 py-6 text-left text-emerald-100/60 font-black uppercase text-[10px] tracking-widest">Descripción del Insumo</th>
                                            <th className="px-8 py-6 text-center text-emerald-100/60 font-black uppercase text-[10px] tracking-widest">Solicitado</th>
                                            <th className="px-8 py-6 text-center text-blue-300 font-black uppercase text-[10px] tracking-widest bg-white/5">Ya Recibido</th>
                                            {isReceiving && <th className="px-8 py-6 text-center text-emerald-400 font-black uppercase text-[10px] tracking-widest animate-pulse">Entra Hoy</th>}
                                            <th className="px-8 py-6 text-center text-amber-300 font-black uppercase text-[10px] tracking-widest">Pendiente</th>
                                            <th className="px-8 py-6 text-right text-emerald-100/60 font-black uppercase text-[10px] tracking-widest border-l border-emerald-900/50">Vr. Total</th>
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
                                    <tfoot className="bg-[#183C30] border-t-4 border-emerald-900">
                                        <tr>
                                            <td colSpan={isReceiving ? 6 : 5} className="px-10 py-10 text-right font-black uppercase tracking-[0.4em] text-xs text-emerald-100/60">Total Bruto a Pagar COP</td>
                                            <td className="px-10 py-10 text-right font-black text-5xl text-white border-l border-emerald-900/50 tabular-nums">
                                                ${(viewingOrden.total_bruto || (viewingOrden.cantidad * (viewingOrden.precio_estimado || 0))).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* OBSERVACIONES */}
                        {viewingOrden.notas && (
                            <div className="bg-amber-50/80 rounded-3xl p-8 border border-amber-100 flex gap-6 items-start shadow-sm">
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-amber-200">
                                    <FileText className="w-6 h-6 text-amber-600" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-black text-amber-800 uppercase text-[10px] tracking-[0.2em]">Notas del Comprador</h4>
                                    <p className="text-amber-900 leading-relaxed font-bold italic text-lg opacity-80">"{viewingOrden.notas}"</p>
                                </div>
                            </div>
                        )}

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
