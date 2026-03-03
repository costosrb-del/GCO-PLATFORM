"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Plus, Trash2, CheckCircle2, AlertCircle, Package, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Tercero, Insumo, OrdenCompra } from "@/hooks/useCompras";
import { API_URL } from "@/lib/config";
import { getAuthToken } from "@/hooks/useAuth";
import { toast } from "sonner";

interface EntregaItem {
    insumoId: string;
    insumo: string;
    cantidadRecibida: number;
}

interface ResultadoDistribucion {
    oc_id: string;
    numeroPedido: string;
    nuevo_estado: string;
    asignado: Record<string, number>;
}

interface EntregasSectionProps {
    terceros: Tercero[];
    insumos: Insumo[];
    ordenes: OrdenCompra[];
}

export const EntregasSection = ({ terceros, insumos, ordenes }: EntregasSectionProps) => {
    const [terceroId, setTerceroId] = useState("");
    const [documentoRef, setDocumentoRef] = useState("");
    const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
    const [recibidoPor, setRecibidoPor] = useState("");
    const [notas, setNotas] = useState("");
    const [items, setItems] = useState<EntregaItem[]>([{ insumoId: "", insumo: "", cantidadRecibida: 0 }]);
    const [isSaving, setIsSaving] = useState(false);
    const [resultado, setResultado] = useState<ResultadoDistribucion[] | null>(null);
    const [showOcsAbiertas, setShowOcsAbiertas] = useState(false);

    const terceroSeleccionado = terceros.find(t => t.id === terceroId);

    const ocsAbiertas = ordenes.filter(
        o => o.terceroId === terceroId && ["Aprobada", "Parcial", "Pendiente"].includes(o.estado)
    ).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));

    const addItem = () => setItems([...items, { insumoId: "", insumo: "", cantidadRecibida: 0 }]);

    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

    const updateItem = (idx: number, field: keyof EntregaItem, value: string | number) => {
        const updated = items.map((it, i) => {
            if (i !== idx) return it;
            if (field === "insumoId") {
                const ins = insumos.find(x => x.id === value);
                return { ...it, insumoId: String(value), insumo: ins?.nombre || "" };
            }
            return { ...it, [field]: value };
        });
        setItems(updated);
    };

    const handleSubmit = async () => {
        if (!terceroId) { toast.error("Selecciona un proveedor"); return; }
        if (!documentoRef.trim()) { toast.error("Ingresa el número de Factura o RM"); return; }
        if (!recibidoPor.trim()) { toast.error("Ingresa quién recibe"); return; }
        const validItems = items.filter(it => it.insumoId && it.cantidadRecibida > 0);
        if (validItems.length === 0) { toast.error("Agrega al menos un ítem con cantidad mayor a 0"); return; }

        setIsSaving(true);
        try {
            const token = await getAuthToken();
            const res = await fetch(`${API_URL}/api/compras/ordenes/registrar-entrega-global`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ terceroId, documentoRef, fecha, recibidoPor, notas, items: validItems })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Error al registrar");

            setResultado(data.distribucion);
            toast.success(data.message);

            // Reset form
            setDocumentoRef("");
            setRecibidoPor("");
            setNotas("");
            setItems([{ insumoId: "", insumo: "", cantidadRecibida: 0 }]);
        } catch (e: any) {
            toast.error(e.message || "Error inesperado");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0f172a] to-[#183C30] rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/5 rounded-full -mr-32 -mt-32 pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                    <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                        <Truck className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">Registro de Entregas</h2>
                        <p className="text-slate-300 text-sm font-medium mt-0.5">
                            Una factura o RM puede cubrir múltiples OCs abiertas — el sistema distribuye automáticamente
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formulario */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-8 space-y-6">
                    <h3 className="font-black text-[#183C30] uppercase text-xs tracking-[0.3em] border-b-2 border-emerald-100 pb-3">
                        Datos de la Entrega
                    </h3>

                    {/* Proveedor */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proveedor</label>
                        <select
                            value={terceroId}
                            onChange={e => { setTerceroId(e.target.value); setResultado(null); }}
                            className="h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        >
                            <option value="">— Selecciona un proveedor —</option>
                            {terceros.map(t => (
                                <option key={t.id} value={t.id}>{t.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* OCs Abiertas de ese proveedor */}
                    {terceroId && ocsAbiertas.length > 0 && (
                        <div className="bg-blue-50 rounded-2xl border border-blue-100 overflow-hidden">
                            <button
                                onClick={() => setShowOcsAbiertas(!showOcsAbiertas)}
                                className="w-full flex justify-between items-center p-4 text-blue-700 font-black text-xs uppercase tracking-widest"
                            >
                                <span className="flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    {ocsAbiertas.length} OC{ocsAbiertas.length > 1 ? "s" : ""} Abierta{ocsAbiertas.length > 1 ? "s" : ""} para este proveedor
                                </span>
                                {showOcsAbiertas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            {showOcsAbiertas && (
                                <div className="border-t border-blue-100 p-4 space-y-2">
                                    {ocsAbiertas.map(oc => (
                                        <div key={oc.id} className="flex justify-between items-center bg-white rounded-xl px-4 py-2 text-sm border border-blue-50">
                                            <span className="font-bold text-slate-700">Pedido {oc.numeroPedido || oc.id.slice(0, 8)}</span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${oc.estado === "Aprobada" ? "bg-emerald-100 text-emerald-700" :
                                                    oc.estado === "Parcial" ? "bg-blue-100 text-blue-700" :
                                                        "bg-amber-100 text-amber-700"
                                                }`}>{oc.estado}</span>
                                            <span className="text-slate-400 text-xs font-bold">
                                                {oc.items ? `${oc.items.length} ítem(s)` : oc.insumo}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {terceroId && ocsAbiertas.length === 0 && (
                        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-amber-700 text-sm font-bold">Este proveedor no tiene OCs abiertas (Aprobada / Parcial / Pendiente)</p>
                        </div>
                    )}

                    {/* Documento, Fecha, Recibido por */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Factura / RM</label>
                            <Input
                                placeholder="FAC-1234 o RM-567"
                                value={documentoRef}
                                onChange={e => setDocumentoRef(e.target.value)}
                                className="h-12 font-bold bg-slate-50 border-slate-200 rounded-xl"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de Entrega</label>
                            <Input
                                type="date"
                                value={fecha}
                                onChange={e => setFecha(e.target.value)}
                                className="h-12 font-bold bg-slate-50 border-slate-200 rounded-xl"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quien Recibe</label>
                            <Input
                                placeholder="Nombre completo"
                                value={recibidoPor}
                                onChange={e => setRecibidoPor(e.target.value)}
                                className="h-12 font-bold bg-slate-50 border-slate-200 rounded-xl"
                            />
                        </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ítems Recibidos</label>
                            <Button onClick={addItem} size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-black text-xs gap-1">
                                <Plus className="w-3 h-3" /> Agregar Ítem
                            </Button>
                        </div>

                        {items.map((it, idx) => (
                            <div key={idx} className="flex gap-3 items-center bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                <select
                                    value={it.insumoId}
                                    onChange={e => updateItem(idx, "insumoId", e.target.value)}
                                    className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                >
                                    <option value="">— Insumo —</option>
                                    {insumos.map(ins => (
                                        <option key={ins.id} value={ins.id}>{ins.nombre} ({ins.sku})</option>
                                    ))}
                                </select>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="Cantidad"
                                    value={it.cantidadRecibida || ""}
                                    onChange={e => updateItem(idx, "cantidadRecibida", Number(e.target.value))}
                                    className="w-32 h-10 text-center font-black bg-white border-slate-200 rounded-xl"
                                />
                                {items.length > 1 && (
                                    <button onClick={() => removeItem(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Notas */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observaciones (opcional)</label>
                        <Input
                            placeholder="Ej: Llegó en buen estado, empaque ligeramente dañado..."
                            value={notas}
                            onChange={e => setNotas(e.target.value)}
                            className="h-12 font-bold bg-slate-50 border-slate-200 rounded-xl"
                        />
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={isSaving || !terceroId || ocsAbiertas.length === 0}
                        className="w-full h-14 bg-[#183C30] hover:bg-emerald-900 text-white rounded-2xl font-black uppercase tracking-widest text-base shadow-lg disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Distribuyendo entre OCs...
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Truck className="w-5 h-5" />
                                Registrar Entrega y Distribuir
                            </div>
                        )}
                    </Button>
                </div>

                {/* Panel lateral: Resultado de distribución */}
                <div className="space-y-6">
                    {resultado && resultado.length > 0 ? (
                        <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                <h3 className="font-black text-[#183C30] uppercase text-xs tracking-[0.2em]">
                                    Distribución Aplicada
                                </h3>
                            </div>
                            <p className="text-xs text-slate-400 font-bold">
                                La entrega fue distribuida en {resultado.length} OC(s) siguiendo el orden FIFO (más antigua primero)
                            </p>
                            <div className="space-y-3">
                                {resultado.map((r, idx) => (
                                    <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-black text-slate-800 text-sm">Pedido {r.numeroPedido}</span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${r.nuevo_estado === "Recibido" ? "bg-emerald-100 text-emerald-700" :
                                                    r.nuevo_estado === "Parcial" ? "bg-blue-100 text-blue-700" :
                                                        "bg-amber-100 text-amber-700"
                                                }`}>{r.nuevo_estado}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {Object.entries(r.asignado).map(([iid, cant]) => {
                                                const ins = insumos.find(x => x.id === iid);
                                                return (
                                                    <span key={iid} className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                                                        {ins?.nombre || iid}: <span className="text-emerald-600">{cant.toLocaleString()}</span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 text-center">
                            <Truck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">
                                El resultado de la distribución aparecerá aquí
                            </p>
                        </div>
                    )}

                    {/* Instrucciones */}
                    <div className="bg-slate-50 rounded-3xl border border-slate-100 p-6 space-y-3">
                        <h4 className="font-black text-slate-600 uppercase text-[10px] tracking-[0.2em]">¿Cómo funciona?</h4>
                        <ol className="space-y-2 text-xs text-slate-500 font-medium list-decimal list-inside">
                            <li>Selecciona el proveedor que entregó la mercancía</li>
                            <li>Ingresa el número de Factura o Remisión</li>
                            <li>Agrega los ítems que llegaron con sus cantidades</li>
                            <li>El sistema distribuye <span className="font-black text-[#183C30]">FIFO</span> (OC más antigua primero)</li>
                            <li>Cada OC afectada registra la entrega en su historial</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};
