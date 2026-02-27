import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, FileText, Package, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { OrdenCompra, Tercero, Insumo } from "@/hooks/useCompras";
import { exportarOrdenPDF } from "../utils/pdfExport";

interface VisualizeOrdenDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    viewingOrden: OrdenCompra | null;
    terceros: Tercero[];
    insumos: Insumo[];
}

export const VisualizeOrdenDialog = ({ open, onOpenChange, viewingOrden, terceros, insumos }: VisualizeOrdenDialogProps) => {
    if (!viewingOrden) return null;

    const currentTercero = terceros.find(t => t.id === viewingOrden.terceroId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] m-0 p-0 border-none shadow-none rounded-none overflow-hidden transition-all duration-300">
                <div className="bg-white overflow-y-auto flex flex-col h-full w-full">
                    {/* Header estilizado */}
                    <div className="bg-[#183C30] p-8 text-white flex justify-between items-start relative">
                        <div className="flex items-start gap-6">
                            <div className="bg-white p-3 rounded-2xl shadow-xl flex-shrink-0 border-4 border-emerald-900/20">
                                <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black tracking-tight uppercase">Autorización de Compra</h2>
                                <div className="flex items-center gap-4 text-emerald-100/80 text-sm font-medium">
                                    <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10 tracking-widest">ID: {viewingOrden.id}</span>
                                    <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest">Pedido: {viewingOrden.numeroPedido || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-3">
                            <div className="text-sm font-black opacity-80 uppercase tracking-[0.2em]">Estado</div>
                            <span className={`px-4 py-1.5 rounded-lg text-sm font-black shadow-lg uppercase tracking-wider ${viewingOrden.estado === 'Recibido' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-[#183C30]'}`}>
                                {viewingOrden.estado}
                            </span>
                            <p className="text-xs font-bold opacity-60 mt-2">Generada: {viewingOrden.created_at ? format(new Date(viewingOrden.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
                        </div>
                    </div>

                    <div className="p-10 space-y-10 flex-1">
                        <div className="grid grid-cols-2 gap-12">
                            {/* PANEL IZQUIERDO: Proveedor */}
                            <div className="space-y-5">
                                <h3 className="flex items-center gap-2 font-black text-[#183C30] uppercase text-xs tracking-[0.3em] border-b-2 border-emerald-100 pb-2">
                                    <Building2 className="w-5 h-5" /> Información del Proveedor
                                </h3>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-5 shadow-sm">
                                    <div className="grid grid-cols-3 gap-2">
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Razón Social</span>
                                        <span className="col-span-2 font-black text-slate-800 text-lg leading-tight">{currentTercero?.nombre || 'Desconocido'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">NIT / NIT</span>
                                        <span className="col-span-2 font-mono font-bold text-slate-600 bg-white px-3 py-1 rounded border inline-block text-sm shadow-sm">{currentTercero?.nit || 'N/A'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 border-t pt-4 border-slate-200/50">
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Contacto</span>
                                        <div className="col-span-2 flex flex-col">
                                            <span className="font-black text-slate-700">{currentTercero?.personaContacto || 'N/A'}</span>
                                            <span className="text-sm font-bold text-slate-500">{currentTercero?.numeroContacto || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* PANEL DERECHO: Logística */}
                            <div className="space-y-5">
                                <h3 className="flex items-center gap-2 font-black text-[#183C30] uppercase text-xs tracking-[0.3em] border-b-2 border-emerald-100 pb-2">
                                    <FileText className="w-5 h-5" /> Detalles Logísticos
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-1">
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Fecha Entrega</span>
                                        <p className="font-black text-slate-800 text-lg">{viewingOrden.fechaSolicitada ? format(parseISO(viewingOrden.fechaSolicitada), 'dd/MM/yyyy') : 'POR DEFINIR'}</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-1">
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Tiempo</span>
                                        <p className="font-black text-slate-800 text-lg uppercase">{viewingOrden.tiempoEntrega || 'INMEDIATO'}</p>
                                    </div>
                                    {(viewingOrden as any).entregasParciales && (
                                        <div className="col-span-2 bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 space-y-1">
                                            <span className="text-emerald-700 text-[10px] font-black uppercase tracking-widest">Entrega Programada</span>
                                            <p className="text-sm text-emerald-900 font-bold">{(viewingOrden as any).entregasParciales}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* TABLA DE PRODUCTOS - AMPLIA */}
                        <div className="space-y-5">
                            <h3 className="flex items-center gap-2 font-black text-[#183C30] uppercase text-xs tracking-[0.3em] border-b-2 border-emerald-100 pb-2">
                                <Package className="w-5 h-5" /> Detalle de Productos Solicitados
                            </h3>
                            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/50 bg-white">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-[#183C30] border-b border-emerald-900">
                                            <th className="px-6 py-5 text-center w-20 text-emerald-100/60 font-black uppercase text-[10px] tracking-widest">Item</th>
                                            <th className="px-6 py-5 text-left text-emerald-100/60 font-black uppercase text-[10px] tracking-widest">Descripción / Producto</th>
                                            <th className="px-6 py-5 text-center text-emerald-100/60 font-black uppercase text-[10px] tracking-widest">Cantidad</th>
                                            <th className="px-6 py-5 text-right text-emerald-100/60 font-black uppercase text-[10px] tracking-widest">Vr. Unitario</th>
                                            <th className="px-6 py-5 text-right text-emerald-100/60 font-black uppercase text-[10px] tracking-widest border-l border-emerald-900/50">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(viewingOrden.items && viewingOrden.items.length > 0) ? (
                                            viewingOrden.items.map((it, idx) => (
                                                <tr key={idx} className="group hover:bg-emerald-50/30 transition-all duration-300">
                                                    <td className="px-6 py-5 text-slate-300 font-mono text-center font-bold text-base">{idx + 1}</td>
                                                    <td className="px-6 py-5 font-black text-slate-800 text-lg uppercase tracking-tight">{it.insumo}</td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-black text-sm border border-slate-200">
                                                            {it.cantidad.toLocaleString()} {it.unidad}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-bold text-slate-500">${(it.precio_estimado || 0).toLocaleString()}</td>
                                                    <td className="px-6 py-5 text-right font-black text-emerald-700 text-xl bg-emerald-50/30 border-l border-slate-100">
                                                        ${((it.cantidad || 0) * (it.precio_estimado || 0)).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr className="group hover:bg-emerald-50/30 transition-all duration-300">
                                                <td className="px-6 py-5 text-slate-300 font-mono text-center font-bold text-base">1</td>
                                                <td className="px-6 py-5 font-black text-slate-800 text-lg uppercase tracking-tight">{viewingOrden.insumo.replace(/ \+\d+ más$/, "")}</td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-black text-sm border border-slate-200">
                                                        {viewingOrden.cantidad.toLocaleString()} {viewingOrden.unidad}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right font-bold text-slate-500">${(viewingOrden.precio_estimado || 0).toLocaleString()}</td>
                                                <td className="px-6 py-5 text-right font-black text-emerald-700 text-xl bg-emerald-50/30 border-l border-slate-100">
                                                    ${(viewingOrden.cantidad * (viewingOrden.precio_estimado || 0)).toLocaleString()}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-[#183C30] border-t-4 border-emerald-900">
                                        <tr>
                                            <td colSpan={4} className="px-8 py-8 text-right font-black uppercase tracking-[0.3em] text-[11px] text-emerald-100/60">Total Bruto a Pagar COP</td>
                                            <td className="px-8 py-8 text-right font-black text-4xl text-white border-l border-emerald-900/50">
                                                ${(viewingOrden.total_bruto || (viewingOrden.cantidad * (viewingOrden.precio_estimado || 0))).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* NOTAS ADICIONALES */}
                        {viewingOrden.notas && (
                            <div className="bg-amber-50/80 rounded-3xl p-8 border border-amber-100 flex gap-6 items-start shadow-sm">
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-amber-200">
                                    <FileText className="w-6 h-6 text-amber-600" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-black text-amber-800 uppercase text-[10px] tracking-[0.2em]">Observaciones Adicionales</h4>
                                    <p className="text-amber-900 leading-relaxed font-bold italic text-lg opacity-80">"{viewingOrden.notas}"</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer de acciones */}
                    <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="px-10 font-black text-slate-400 hover:text-slate-600 h-14 rounded-2xl uppercase tracking-widest text-xs hover:bg-slate-100">
                            Cerrar Vista
                        </Button>
                        <Button onClick={() => {
                            if (currentTercero) exportarOrdenPDF(viewingOrden, currentTercero, insumos);
                        }} className="bg-[#183C30] hover:bg-emerald-900 text-white px-12 h-14 rounded-2xl font-black flex items-center gap-4 shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                            <Download className="w-6 h-6 text-emerald-400" />
                            <span className="uppercase tracking-widest text-xs">Descargar Autorización PDF</span>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
