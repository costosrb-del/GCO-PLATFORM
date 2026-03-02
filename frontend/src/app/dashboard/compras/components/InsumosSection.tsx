import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, Trash2, Filter, X, Edit2 } from "lucide-react";
import { Insumo } from "@/hooks/useCompras";

interface InsumosSectionProps {
    insumos: Insumo[];
    createInsumo: (i: Partial<Insumo>) => Promise<boolean>;
    updateInsumo: (id: string, i: Partial<Insumo>) => Promise<boolean>;
    deleteInsumo: (id: string) => Promise<boolean>;
}

export const InsumosSection = ({ insumos, createInsumo, updateInsumo, deleteInsumo }: InsumosSectionProps) => {
    const [isInsumoDialogOpen, setIsInsumoDialogOpen] = useState(false);
    const [searchInsumos, setSearchInsumos] = useState("");
    const [filterClasificacion, setFilterClasificacion] = useState<string>("none");
    const [insumoForm, setInsumoForm] = useState<Partial<Insumo>>({
        sku: "", nombre: "", rendimiento: "", unidad: "Unidad", proveedores: [], clasificacion: "Materia Prima"
    });

    const handleSaveInsumo = async () => {
        if (!insumoForm.nombre) return;

        if (insumoForm.id) {
            await updateInsumo(insumoForm.id, insumoForm);
        } else {
            const autoSku = insumoForm.sku || `INS-${Math.floor(1000 + Math.random() * 9000)}`;
            await createInsumo({ ...insumoForm, sku: autoSku });
        }

        setInsumoForm({ sku: "", nombre: "", rendimiento: "", unidad: "Unidad", proveedores: [], clasificacion: "Materia Prima" });
        setIsInsumoDialogOpen(false);
    };

    const editInsumo = (i: Insumo) => {
        setInsumoForm({ ...i });
        setIsInsumoDialogOpen(true);
    };

    const clasificacionesUnicas = Array.from(new Set(insumos.map(i => i.clasificacion).filter(Boolean)));

    const filteredInsumos = useMemo(() => {
        return insumos.filter(i => {
            const matchesSearch = i.nombre.toLowerCase().includes(searchInsumos.toLowerCase()) ||
                i.sku.toLowerCase().includes(searchInsumos.toLowerCase()) ||
                (i.rendimiento || "").toLowerCase().includes(searchInsumos.toLowerCase()) ||
                (i.clasificacion || "").toLowerCase().includes(searchInsumos.toLowerCase()) ||
                (i.unidad || "").toLowerCase().includes(searchInsumos.toLowerCase());

            const matchesClasificacion = filterClasificacion !== "none" ? i.clasificacion === filterClasificacion : true;

            return matchesSearch && matchesClasificacion;
        });
    }, [insumos, searchInsumos, filterClasificacion]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Package className="w-5 h-5 text-teal-600" />
                    Base de Datos de Insumos (SKUs)
                </h2>
                <div className="flex w-full md:w-auto items-center gap-3">
                    <Dialog open={isInsumoDialogOpen} onOpenChange={setIsInsumoDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md" onClick={() => {
                                setInsumoForm({ sku: "", nombre: "", rendimiento: "", unidad: "Unidad", proveedores: [], clasificacion: "Materia Prima" });
                            }}>
                                <Plus className="w-4 h-4 mr-2" />
                                Nuevo Insumo
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                    {insumoForm.id ? "Actualizar Insumo" : "Registrar Nuevo Insumo"}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-5 py-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">SKU / Código Interno (Opcional)</label>
                                    <Input className="h-11 font-mono uppercase bg-slate-50 border-slate-200" value={insumoForm.sku} onChange={e => setInsumoForm({ ...insumoForm, sku: e.target.value.toUpperCase() })} placeholder="Autogenerado si está vacío" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Nombre del Insumo</label>
                                    <Input className="h-11 border-slate-200" value={insumoForm.nombre} onChange={e => setInsumoForm({ ...insumoForm, nombre: e.target.value })} placeholder="Ej. Alcohol Extra Neutro" />
                                </div>
                                <div className="flex gap-4">
                                    <div className="space-y-2 flex-1">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Unidad de Medida</label>
                                        <Select value={insumoForm.unidad} onValueChange={v => setInsumoForm({ ...insumoForm, unidad: v })}>
                                            <SelectTrigger className="h-11 border-slate-200"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Unidad">Unidad</SelectItem>
                                                <SelectItem value="Litro">Litros</SelectItem>
                                                <SelectItem value="Kilogramo">Kilogramos</SelectItem>
                                                <SelectItem value="Metro">Metros</SelectItem>
                                                <SelectItem value="Par">Par</SelectItem>
                                                <SelectItem value="Rollo">Rollo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Rendimiento (Mfg)</label>
                                        <Input className="h-11 border-slate-200" value={insumoForm.rendimiento} onChange={e => setInsumoForm({ ...insumoForm, rendimiento: e.target.value })} placeholder="Ej. Rinde 50 unds" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Clasificación</label>
                                    <Select value={insumoForm.clasificacion || "Materia Prima"} onValueChange={v => setInsumoForm({ ...insumoForm, clasificacion: v })}>
                                        <SelectTrigger className="h-11 border-slate-200 font-bold text-teal-700 bg-teal-50/50"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Materia Prima">Materia Prima</SelectItem>
                                            <SelectItem value="Envase">Envase</SelectItem>
                                            <SelectItem value="Tapa">Tapa</SelectItem>
                                            <SelectItem value="Lainer">Lainer</SelectItem>
                                            <SelectItem value="Termoencogible">Termoencogible</SelectItem>
                                            <SelectItem value="Caja">Caja</SelectItem>
                                            <SelectItem value="Etiqueta">Etiqueta</SelectItem>
                                            <SelectItem value="Laboratorio">Laboratorio</SelectItem>
                                            <SelectItem value="Químico">Químico</SelectItem>
                                            <SelectItem value="Fragancia">Fragancia</SelectItem>
                                            <SelectItem value="Suministro">Suministro</SelectItem>
                                            <SelectItem value="Otro">Otro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleSaveInsumo} className="mt-6 bg-[#183C30] hover:bg-emerald-900 h-12 rounded-xl text-lg font-black shadow-lg uppercase tracking-wider">
                                    {insumoForm.id ? "Guardar Cambios" : "Guardar Insumo"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Fila de Filtros Avanzados */}
            <div className="flex flex-wrap gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-2 items-center">
                <div className="flex-1 min-w-[250px] flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <Select value={filterClasificacion} onValueChange={setFilterClasificacion}>
                        <SelectTrigger className="bg-slate-50 border-gray-100 text-sm font-semibold">
                            <SelectValue placeholder="Filtrar por Etiqueta / Clasificación" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Todas las Clasificaciones</SelectItem>
                            {clasificacionesUnicas.map(cat => <SelectItem key={cat as string} value={cat as string}>{cat}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-[300px] flex items-center gap-2">
                    <Input
                        className="bg-slate-50 border-gray-100 placeholder:text-gray-400 focus-visible:ring-teal-500"
                        placeholder="Buscar por Nombre, SKU..."
                        value={searchInsumos}
                        onChange={(e) => setSearchInsumos(e.target.value)}
                    />
                </div>
                {(filterClasificacion !== "none" || searchInsumos) && (
                    <Button variant="ghost" onClick={() => { setFilterClasificacion("none"); setSearchInsumos(""); }} className="text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4 mr-2" /> Limpiar
                    </Button>
                )}
            </div>

            {/* Tabla de Insumos */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-[1.5fr_2fr_1.5fr_1fr_1fr_auto] p-4 bg-slate-50 border-b border-gray-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div>SKU / Código</div>
                    <div>Insumo / Descripción</div>
                    <div>Clasificación</div>
                    <div className="text-center">Unidad Def.</div>
                    <div className="text-center">Rendimiento</div>
                    <div className="w-[120px] text-center">Acciones</div>
                </div>
                <div className="divide-y divide-gray-50 max-h-[65vh] overflow-y-auto">
                    {filteredInsumos.map(i => (
                        <div key={i.id} className="grid grid-cols-[1.5fr_2fr_1.5fr_1fr_1fr_auto] p-4 items-center hover:bg-slate-50/50 transition-colors group">
                            <div>
                                <span className="font-mono text-xs font-black bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">{i.sku}</span>
                            </div>
                            <div className="pr-4">
                                <h3 className="font-bold text-slate-800 text-sm uppercase">{i.nombre}</h3>
                            </div>
                            <div>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-teal-50 text-teal-700 border border-teal-100 shadow-sm">
                                    {i.clasificacion || 'Materia Prima'}
                                </span>
                            </div>
                            <div className="text-center">
                                <span className="text-xs font-semibold text-slate-600 bg-slate-100 py-1 px-3 rounded-md">{i.unidad}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-xs font-normal text-slate-500 italic">{i.rendimiento || 'N/A'}</span>
                            </div>
                            <div className="w-[120px] flex justify-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" onClick={() => editInsumo(i)} className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 h-8 w-8" title="Editar Insumo">
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteInsumo(i.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8" title="Eliminar Insumo">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {filteredInsumos.length === 0 && (
                        <div className="p-12 text-center">
                            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">No hay insumos que coincidan con los filtros aplicados.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
