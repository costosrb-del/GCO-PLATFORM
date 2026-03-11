import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    Plus, Building2, Edit2, Trash2, Phone, Mail,
    Package, DollarSign, AlertCircle, Search, X, ChevronDown, ChevronUp, CheckCircle2, FileDown
} from "lucide-react";
import { Tercero, Insumo, OrdenCompra, PrecioEscala } from "@/hooks/useCompras";
import { exportarCatalogoProveedorPDF } from "../utils/pdfExport";
import { toast } from "sonner";


interface TercerosSectionProps {
    terceros: Tercero[];
    insumos: Insumo[];
    createTercero: (t: Partial<Tercero>) => Promise<boolean>;
    updateTercero: (id: string, t: Partial<Tercero>) => Promise<boolean>;
    deleteTercero: (id: string) => Promise<boolean>;
    ordenes?: OrdenCompra[];
}

export const TercerosSection = ({ terceros, insumos, createTercero, updateTercero, deleteTercero, ordenes = [] }: TercerosSectionProps) => {
    const [isTerceroDialogOpen, setIsTerceroDialogOpen] = useState(false);
    const [searchTerceros, setSearchTerceros] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [terceroForm, setTerceroForm] = useState<Partial<Tercero>>({
        nombre: "", nit: "", correo: "", personaContacto: "", numeroContacto: "", insumos: "",
        insumosPrecios: []
    });
    const [searchInsumoText, setSearchInsumoText] = useState("");

    // ── Estadísticas por proveedor ────────────────────────────────────────────
    const statsMap = useMemo(() => {
        const map: Record<string, { totalOC: number; activas: number; inversion: number }> = {};
        for (const o of ordenes) {
            if (!o.terceroId) continue;
            if (!map[o.terceroId]) map[o.terceroId] = { totalOC: 0, activas: 0, inversion: 0 };
            map[o.terceroId].totalOC++;
            if (["Pendiente", "Aprobada", "Parcial"].includes(o.estado)) map[o.terceroId].activas++;
            map[o.terceroId].inversion += o.total_bruto ?? ((o.cantidad ?? 0) * (o.precio_estimado ?? 0));
        }
        return map;
    }, [ordenes]);

    // ── Insumos que tiene este proveedor ──────────────────────────────────────
    const getInsumosDeTercero = (t: Tercero) => {
        return insumos.filter(i =>
            (t.insumos || "").toLowerCase().includes(`[${i.sku.toLowerCase()}]`) ||
            t.insumosPrecios?.some(ip => ip.insumoId === i.id)
        );
    };

    // ── Precio por insumo ─────────────────────────────────────────────────────
    const getPrecioPorInsumo = (t: Tercero, insumoId: string): number =>
        t.insumosPrecios?.find(ip => ip.insumoId === insumoId)?.precio ?? 0;

    const getEscalasPorInsumo = (t: Tercero, insumoId: string): PrecioEscala[] =>
        t.insumosPrecios?.find(ip => ip.insumoId === insumoId)?.escalas ?? [];

    const setPrecioPorInsumo = (insumoId: string, precio: number) => {
        const current = terceroForm.insumosPrecios || [];
        const idx = current.findIndex(ip => ip.insumoId === insumoId);
        const updated = [...current];
        if (idx >= 0) updated[idx] = { ...updated[idx], precio };
        else updated.push({ insumoId, precio });
        setTerceroForm({ ...terceroForm, insumosPrecios: updated });
    };

    const setEscalasPorInsumo = (insumoId: string, escalas: PrecioEscala[]) => {
        const current = terceroForm.insumosPrecios || [];
        const idx = current.findIndex(ip => ip.insumoId === insumoId);
        const updated = [...current];
        if (idx >= 0) updated[idx] = { ...updated[idx], escalas };
        else updated.push({ insumoId, precio: 0, escalas });
        setTerceroForm({ ...terceroForm, insumosPrecios: updated });
    };

    const handleSaveTercero = async () => {
        if (!terceroForm.nombre || !terceroForm.nit) return;

        // BARRERA: Evitar proveedores repetidos (mismo nombre o mismo NIT)
        const duplicate = terceros.find(t =>
            (t.nombre.toLowerCase().trim() === (terceroForm.nombre ?? "").toLowerCase().trim() ||
                (t.nit.trim() !== "" && t.nit.toLowerCase().trim() === (terceroForm.nit ?? "").toLowerCase().trim()))
            && t.id !== terceroForm.id
        );

        if (duplicate) {
            toast.error(`Ya existe un proveedor con el nombre "${duplicate.nombre}" o NIT "${duplicate.nit}". No se permiten duplicados.`);
            return;
        }

        if (terceroForm.id) {
            await updateTercero(terceroForm.id, terceroForm);
        } else {
            await createTercero(terceroForm);
        }
        setTerceroForm({ nombre: "", nit: "", correo: "", personaContacto: "", numeroContacto: "", insumos: "", insumosPrecios: [] });
        setIsTerceroDialogOpen(false);
    };

    const editTercero = (t: Tercero) => {
        setTerceroForm({ ...t, insumosPrecios: t.insumosPrecios || [] });
        setIsTerceroDialogOpen(true);
    };

    const filteredTerceros = useMemo(() =>
        terceros.filter(t =>
            t.nombre.toLowerCase().includes(searchTerceros.toLowerCase()) ||
            t.nit.toLowerCase().includes(searchTerceros.toLowerCase()) ||
            (t.insumos || "").toLowerCase().includes(searchTerceros.toLowerCase()) ||
            t.personaContacto?.toLowerCase().includes(searchTerceros.toLowerCase())
        ), [terceros, searchTerceros]);

    // ── Insumos seleccionados en el formulario ────────────────────────────────
    const insumosSeleccionados = useMemo(() =>
        insumos.filter(i =>
            terceroForm.insumos?.toLowerCase().includes(`[${i.sku.toLowerCase()}]`) ||
            terceroForm.insumosPrecios?.some(ip => ip.insumoId === i.id)
        ), [insumos, terceroForm.insumos, terceroForm.insumosPrecios]);

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-600" />
                        Base de Terceros y Proveedores
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">{terceros.length} proveedores · Gestiona precios, contactos y OC por proveedor</p>
                </div>
                <div className="flex gap-3 items-center w-full md:w-auto">
                    <div className="relative flex-1 md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input className="pl-9 bg-white rounded-xl border-gray-100" placeholder="Buscar proveedor, NIT, insumo..."
                            value={searchTerceros} onChange={e => setSearchTerceros(e.target.value)} />
                        {searchTerceros && (
                            <button onClick={() => setSearchTerceros("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                        )}
                    </div>
                    <Dialog open={isTerceroDialogOpen} onOpenChange={setIsTerceroDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shrink-0"
                                onClick={() => setTerceroForm({ nombre: "", nit: "", correo: "", personaContacto: "", numeroContacto: "", insumos: "", insumosPrecios: [] })}>
                                <Plus className="w-4 h-4 mr-2" /> Nuevo Proveedor
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-[800px] lg:max-w-[1000px] w-full max-h-[90vh] overflow-y-auto rounded-3xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-slate-800">
                                    {terceroForm.id ? "Editar Proveedor" : "Registrar Proveedor"}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Razón Social *</label>
                                        <Input value={terceroForm.nombre} onChange={e => setTerceroForm({ ...terceroForm, nombre: e.target.value })} placeholder="Ej. Distribuidora Química S.A" className="h-11" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">NIT *</label>
                                        <Input value={terceroForm.nit} onChange={e => setTerceroForm({ ...terceroForm, nit: e.target.value })} placeholder="900.123.456-7" className="h-11 font-mono" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Correo</label>
                                        <Input type="email" value={terceroForm.correo} onChange={e => setTerceroForm({ ...terceroForm, correo: e.target.value })} placeholder="contacto@empresa.com" className="h-11" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Persona de Contacto</label>
                                        <Input value={terceroForm.personaContacto} onChange={e => setTerceroForm({ ...terceroForm, personaContacto: e.target.value })} placeholder="Nombre" className="h-11" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Teléfono</label>
                                        <Input value={terceroForm.numeroContacto} onChange={e => setTerceroForm({ ...terceroForm, numeroContacto: e.target.value })} placeholder="300 000 0000" className="h-11" />
                                    </div>
                                </div>

                                {/* Selector visual de insumos con precio por insumo */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                        <Package className="w-3.5 h-3.5" /> Vincular Insumos (Buscador)
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                                        <Input
                                            placeholder="Filtrar insumos por nombre o SKU..."
                                            value={searchInsumoText}
                                            onChange={(e) => setSearchInsumoText(e.target.value)}
                                            className="h-9 pl-8 text-xs border-indigo-100 placeholder:text-gray-400"
                                        />
                                    </div>
                                    <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50/50">
                                        {insumos
                                            .filter(i =>
                                                i.nombre.toLowerCase().includes(searchInsumoText.toLowerCase()) ||
                                                i.sku.toLowerCase().includes(searchInsumoText.toLowerCase())
                                            )
                                            .slice(0, 50)
                                            .map(i => {
                                                const sel = terceroForm.insumos?.toLowerCase().includes(`[${i.sku.toLowerCase()}]`);
                                                return (
                                                    <div key={i.id}
                                                        onClick={() => {
                                                            const cur = terceroForm.insumos || "";
                                                            const tag = `[${i.sku}] ${i.nombre}, `;
                                                            setTerceroForm({ ...terceroForm, insumos: sel ? cur.replace(tag, "") : cur + tag });
                                                        }}
                                                        className={`px-3 py-2 cursor-pointer text-xs flex justify-between items-center border-b last:border-0 hover:bg-white transition-colors ${sel ? "bg-indigo-50/50 text-indigo-700 font-bold" : "text-gray-600"}`}>
                                                        <span className="truncate">
                                                            <span className="font-mono text-[10px] text-gray-400 mr-2">{i.sku}</span>
                                                            {i.nombre}
                                                        </span>
                                                        {sel ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> : <Plus className="w-3.5 h-3.5 text-gray-300" />}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>

                                {/* Precios por insumo seleccionado */}
                                {insumosSeleccionados.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Precio pactado por insumo (COP/unidad)
                                        </label>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {insumosSeleccionados.map(i => {
                                                const escalas = getEscalasPorInsumo(terceroForm as Tercero, i.id);
                                                return (
                                                    <div key={i.id} className="space-y-2 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-gray-800 truncate">{i.nombre}</p>
                                                                <p className="text-[10px] text-gray-400 font-mono">{i.sku} · {i.unidad}</p>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase mr-1">Base</span>
                                                                <span className="text-xs text-gray-400">$</span>
                                                                <Input type="number" min={0}
                                                                    value={getPrecioPorInsumo(terceroForm as Tercero, i.id) || ""}
                                                                    onChange={e => setPrecioPorInsumo(i.id, Number(e.target.value))}
                                                                    className="w-24 h-8 text-sm font-bold text-right"
                                                                    placeholder="0" />
                                                            </div>
                                                        </div>

                                                        {/* Escalas de precios */}
                                                        <div className="pl-4 border-l-2 border-emerald-200 space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Escalas de Volumen</span>
                                                                <Button variant="ghost" size="sm" onClick={() => setEscalasPorInsumo(i.id, [...escalas, { min: 0, precio: 0 }])}
                                                                    className="h-5 text-[9px] font-bold text-emerald-600 hover:bg-white px-2">
                                                                    <Plus className="w-2.5 h-2.5 mr-1" /> Añadir Escala
                                                                </Button>
                                                            </div>
                                                            {escalas.map((esc, eIdx) => (
                                                                <div key={eIdx} className="flex items-center gap-2 animate-in slide-in-from-left-1">
                                                                    <span className="text-[10px] text-gray-400 min-w-[30px]">Min.</span>
                                                                    <Input type="number"
                                                                        value={esc.min || ""}
                                                                        onChange={e => {
                                                                            const next = [...escalas];
                                                                            next[eIdx].min = Number(e.target.value);
                                                                            setEscalasPorInsumo(i.id, next);
                                                                        }}
                                                                        className="h-7 w-16 text-[10px] font-bold" placeholder="0" />
                                                                    <span className="text-[10px] text-gray-400">Precio</span>
                                                                    <Input type="number"
                                                                        value={esc.precio || ""}
                                                                        onChange={e => {
                                                                            const next = [...escalas];
                                                                            next[eIdx].precio = Number(e.target.value);
                                                                            setEscalasPorInsumo(i.id, next);
                                                                        }}
                                                                        className="h-7 flex-1 text-[10px] font-bold" placeholder="$" />
                                                                    <Button variant="ghost" size="sm" onClick={() => {
                                                                        const next = escalas.filter((_, idx) => idx !== eIdx);
                                                                        setEscalasPorInsumo(i.id, next);
                                                                    }} className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                                                                        <X className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <Button onClick={handleSaveTercero}
                                    className="h-12 bg-[#183C30] hover:bg-[#122e24] text-white font-bold rounded-xl text-base mt-2">
                                    Guardar Proveedor
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Tabla de terceros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] p-4 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <div>Proveedor</div>
                    <div>Contacto Directo</div>
                    <div className="text-center">Insumos</div>
                    <div className="text-center">OC Historial</div>
                    <div className="w-20 text-center">Acciones</div>
                </div>
                <div className="divide-y divide-gray-50 max-h-[62vh] overflow-y-auto">
                    {filteredTerceros.map(t => {
                        const insumosT = getInsumosDeTercero(t);
                        const stats = statsMap[t.id] ?? { totalOC: 0, activas: 0, inversion: 0 };
                        const isExpanded = expandedId === t.id;

                        return (
                            <div key={t.id}>
                                <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] p-4 items-center hover:bg-slate-50/60 transition-colors group cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : t.id)}>

                                    {/* Proveedor */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                                <Building2 className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-800 text-sm truncate">{t.nombre}</p>
                                                <p className="text-[10px] text-gray-400 font-mono">NIT: {t.nit}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contacto con links clickeables */}
                                    <div className="space-y-1 min-w-0" onClick={e => e.stopPropagation()}>
                                        <p className="text-xs font-semibold text-gray-700 truncate">{t.personaContacto}</p>
                                        <div className="flex gap-2">
                                            {t.correo && (
                                                <a href={`mailto:${t.correo}`}
                                                    className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 hover:underline"
                                                    title={t.correo}>
                                                    <Mail className="w-3 h-3" /> Email
                                                </a>
                                            )}
                                            {t.numeroContacto && (
                                                <a href={`tel:${t.numeroContacto}`}
                                                    className="flex items-center gap-1 text-[10px] text-emerald-500 hover:text-emerald-700 hover:underline">
                                                    <Phone className="w-3 h-3" /> {t.numeroContacto}
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* # Insumos */}
                                    <div className="flex justify-center">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${insumosT.length > 0 ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-400"}`}>
                                            {insumosT.length} insumos
                                        </span>
                                    </div>

                                    {/* Stats OC */}
                                    <div className="text-center space-y-0.5">
                                        <p className="text-xs font-bold text-gray-700">{stats.totalOC} OC</p>
                                        {stats.activas > 0 && (
                                            <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                                                {stats.activas} activas
                                            </span>
                                        )}
                                        {stats.inversion > 0 && (
                                            <p className="text-[10px] text-teal-600 font-semibold">${stats.inversion.toLocaleString("es-CO")}</p>
                                        )}
                                    </div>

                                    {/* Acciones */}
                                    <div className="w-24 flex justify-center gap-0.5" onClick={e => e.stopPropagation()}>
                                        {isExpanded ?
                                            <ChevronUp className="w-4 h-4 text-gray-300" /> :
                                            <ChevronDown className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                                        }
                                        <Button variant="ghost" size="icon" onClick={() => exportarCatalogoProveedorPDF(t, insumos)}
                                            className="text-teal-400 hover:bg-teal-50 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" title="Descargar Ficha Técnica">
                                            <FileDown className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => editTercero(t)}
                                            className="text-blue-400 hover:bg-blue-50 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteTercero(t.id)}
                                            className="text-red-400 hover:bg-red-50 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Fila expandida: insumos con precios */}
                                {isExpanded && (
                                    <div className="px-6 pb-4 bg-indigo-50/30 border-t border-indigo-100/50">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider pt-3 pb-2">
                                            Catálogo de insumos de este proveedor
                                        </p>
                                        {insumosT.length === 0 ? (
                                            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                Sin insumos asignados. Edita el proveedor y asigna los SKUs que suministra.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                {insumosT.map(i => {
                                                    const precio = getPrecioPorInsumo(t, i.id);
                                                    return (
                                                        <div key={i.id} className="relative bg-white rounded-xl border border-indigo-100 p-2.5 flex flex-col gap-1 group">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="absolute top-1 right-1 h-6 w-6 text-red-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const tag = `[${i.sku}] ${i.nombre}, `;
                                                                    const newInsumosStr = (t.insumos || "").replace(tag, "");
                                                                    const newPrecios = (t.insumosPrecios || []).filter(ip => ip.insumoId !== i.id);
                                                                    updateTercero(t.id, {
                                                                        insumos: newInsumosStr,
                                                                        insumosPrecios: newPrecios
                                                                    });
                                                                    toast.success(`Insumo desasociado de ${t.nombre}`);
                                                                }}
                                                                title="Desasociar insumo"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </Button>
                                                            <p className="text-xs font-bold text-gray-800 pr-5 truncate">{i.nombre}</p>
                                                            <p className="text-[10px] text-gray-400 font-mono">{i.sku} · {i.unidad}</p>
                                                            {precio > 0 ? (
                                                                <p className="text-xs font-black text-emerald-600">${precio.toLocaleString("es-CO")}/u</p>
                                                            ) : (
                                                                <p className="text-[10px] text-amber-500">Sin precio configurado</p>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filteredTerceros.length === 0 && (
                        <div className="p-12 text-center">
                            <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400 font-medium">No hay proveedores que coincidan.</p>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
};
