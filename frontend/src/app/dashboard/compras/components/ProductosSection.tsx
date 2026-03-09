import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Plus, Factory, Edit2, Trash2, X, AlertCircle, CheckCircle2,
    DollarSign, Copy, Filter, Search
} from "lucide-react";
import { ProductoFabricado, Insumo } from "@/hooks/useCompras";
import { toast } from "sonner";

/**
 * Parsea el campo rendimiento:
 * - "80%"  → 0.8  (eficiencia)
 * - "50"   → 50   (unidades por empaque)
 */
function parseRendimientoFactor(raw: string | undefined): number {
    if (!raw || raw.trim() === "" || raw === "N/A") return 1;
    const s = raw.trim();
    if (s.includes("%")) {
        const n = parseFloat(s.replace("%", ""));
        if (!isNaN(n) && n > 0) return n / 100;
    }
    const n = parseFloat(s);
    if (!isNaN(n) && n > 0) return n;
    return 1;
}

interface ProductosSectionProps {
    productos: ProductoFabricado[];
    insumos: Insumo[];
    createProducto: (p: Partial<ProductoFabricado>) => Promise<boolean>;
    updateProducto: (id: string, p: Partial<ProductoFabricado>) => Promise<boolean>;
    deleteProducto: (id: string) => Promise<boolean>;
}

export const ProductosSection = ({ productos, insumos, createProducto, updateProducto, deleteProducto }: ProductosSectionProps) => {
    const [isProductoDialogOpen, setIsProductoDialogOpen] = useState(false);
    const [searchProductos, setSearchProductos] = useState("");
    const [filterMode, setFilterMode] = useState<"todos" | "completos" | "incompletos">("todos");
    const [productoForm, setProductoForm] = useState<Partial<ProductoFabricado>>({
        nombre: "", sku: "", descripcion: "", categoria: "", insumosAsociados: []
    });
    const [searchInsumoText, setSearchInsumoText] = useState("");

    // ── Calcular costo y completitud ─────────────────────────────────────────
    const getProductStats = (p: ProductoFabricado) => {
        const count = p.insumosAsociados?.length ?? 0;
        const completo = count > 0;
        const costo = p.insumosAsociados?.reduce((acc, ia) => {
            const ins = insumos.find(i => i.id === ia.insumoId);
            const factor = parseRendimientoFactor(ins?.rendimiento);
            const unitPrice = (ins?.precio ?? 0) / factor;
            return acc + (unitPrice * ia.cantidadRequerida);
        }, 0) ?? 0;
        // Insumos con SKU huérfano (insumo eliminado)
        const rotos = p.insumosAsociados?.filter(ia => !insumos.find(i => i.id === ia.insumoId)).length ?? 0;
        return { count, completo, costo, rotos };
    };

    // ── Filtros ────────────────────────────────────────────────────────────────
    const filteredProductos = useMemo(() => {
        return productos.filter(p => {
            const matchesSearch = p.nombre.toLowerCase().includes(searchProductos.toLowerCase()) ||
                (p.sku ?? "").toLowerCase().includes(searchProductos.toLowerCase()) ||
                (p.categoria ?? "").toLowerCase().includes(searchProductos.toLowerCase());
            if (!matchesSearch) return false;
            const { completo } = getProductStats(p);
            if (filterMode === "completos") return completo;
            if (filterMode === "incompletos") return !completo;
            return true;
        });
    }, [productos, searchProductos, filterMode, insumos]);

    // ── Estadísticas globales ─────────────────────────────────────────────────
    const globalStats = useMemo(() => {
        const completos = productos.filter(p => (p.insumosAsociados?.length ?? 0) > 0).length;
        const sinFicha = productos.length - completos;
        const costoTotal = productos.reduce((acc, p) =>
            acc + (p.insumosAsociados?.reduce((s, ia) => {
                const ins = insumos.find(i => i.id === ia.insumoId);
                const factor = parseRendimientoFactor(ins?.rendimiento);
                const unitPrice = (ins?.precio ?? 0) / factor;
                return s + (unitPrice * ia.cantidadRequerida);
            }, 0) ?? 0), 0);
        return { completos, sinFicha, costoTotal };
    }, [productos, insumos]);

    const handleSaveProducto = async () => {
        if (!productoForm.nombre) return;
        const autoSku = productoForm.sku || `PRD-${Math.floor(1000 + Math.random() * 9000)}`;
        if (productoForm.id) {
            await updateProducto(productoForm.id, { ...productoForm, sku: autoSku });
        } else {
            await createProducto({ ...productoForm, sku: autoSku });
        }
        setProductoForm({ id: undefined, sku: "", nombre: "", descripcion: "", categoria: "", insumosAsociados: [] });
        setIsProductoDialogOpen(false);
    };

    const editProducto = (p: ProductoFabricado) => {
        setProductoForm({ ...p, insumosAsociados: p.insumosAsociados || [] });
        setIsProductoDialogOpen(true);
    };

    /** Copiar BOM de otro producto */
    const copiarBOM = (sourceId: string) => {
        const source = productos.find(p => p.id === sourceId);
        if (!source?.insumosAsociados?.length) return;
        setProductoForm(prev => ({
            ...prev,
            insumosAsociados: [...(source.insumosAsociados ?? [])],
        }));
        toast.success(`BOM copiado de "${source.nombre}"`);
    };

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Factory className="w-5 h-5 text-fuchsia-600" />
                        Base de Productos Fabricados
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">{productos.length} productos · Fichas técnicas de insumos (BOM)</p>
                </div>
                <Dialog open={isProductoDialogOpen} onOpenChange={setIsProductoDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl shadow-md shrink-0"
                            onClick={() => setProductoForm({ id: undefined, sku: "", nombre: "", descripcion: "", categoria: "", insumosAsociados: [] })}>
                            <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-slate-800">
                                {productoForm.id ? "Editar Producto" : "Registrar Producto Fabricado"}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">SKU (Opcional)</label>
                                    <Input value={productoForm.sku} className="h-10 font-mono"
                                        onChange={e => setProductoForm({ ...productoForm, sku: e.target.value.toUpperCase() })}
                                        placeholder="Autogenerado" />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre del Producto *</label>
                                    <Input value={productoForm.nombre} className="h-10"
                                        onChange={e => setProductoForm({ ...productoForm, nombre: e.target.value })}
                                        placeholder="Ej. Kit Capilar 120ml" />
                                </div>
                            </div>

                            {/* Copiar BOM de otro producto */}
                            {productos.filter(p => p.id !== productoForm.id && (p.insumosAsociados?.length ?? 0) > 0).length > 0 && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                        <Copy className="w-3 h-3 text-fuchsia-400" /> Copiar BOM de otro producto
                                    </label>
                                    <Select value="" onValueChange={copiarBOM}>
                                        <SelectTrigger className="h-9 text-sm border-fuchsia-100 bg-fuchsia-50/50">
                                            <SelectValue placeholder="Seleccionar producto fuente..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {productos.filter(p => p.id !== productoForm.id && (p.insumosAsociados?.length ?? 0) > 0).map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    <span className="font-mono text-[10px] text-gray-400 mr-1">{p.sku}</span>
                                                    {p.nombre} ({p.insumosAsociados?.length} insumos)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Agregar insumos al BOM */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Insumos del BOM</label>
                                <div className="space-y-2 mb-2">
                                    <Input
                                        placeholder="🔍 Buscar insumo para agregar..."
                                        value={searchInsumoText}
                                        onChange={(e) => setSearchInsumoText(e.target.value)}
                                        className="h-9 text-xs border-fuchsia-100 placeholder:text-gray-400"
                                    />
                                </div>
                                <Select value="" onValueChange={v => {
                                    const existe = productoForm.insumosAsociados?.find(ia => ia.insumoId === v);
                                    if (!existe) {
                                        const ins = insumos.find(i => i.id === v);
                                        setProductoForm({
                                            ...productoForm,
                                            insumosAsociados: [...(productoForm.insumosAsociados ?? []), { insumoId: v, cantidadRequerida: 1 }]
                                        });
                                        setSearchInsumoText(""); // Clear search after selection
                                    }
                                }}>
                                    <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar insumo filtrado..." /></SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        {insumos
                                            .filter(i => 
                                                i.nombre.toLowerCase().includes(searchInsumoText.toLowerCase()) || 
                                                i.sku.toLowerCase().includes(searchInsumoText.toLowerCase())
                                            )
                                            .map(i => (
                                                <SelectItem key={i.id} value={i.id}>
                                                    <span className="font-mono text-[10px] text-gray-400 mr-1">{i.sku}</span>
                                                    {i.nombre}
                                                    {i.precio ? <span className="ml-1 text-emerald-600 text-[10px]">${i.precio.toLocaleString()}</span> : null}
                                                </SelectItem>
                                            ))}
                                        {insumos.filter(i => 
                                                i.nombre.toLowerCase().includes(searchInsumoText.toLowerCase()) || 
                                                i.sku.toLowerCase().includes(searchInsumoText.toLowerCase())
                                            ).length === 0 && (
                                            <div className="p-2 text-xs text-center text-gray-400">No se encontraron resultados</div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Lista de insumos del BOM actual */}
                            {(productoForm.insumosAsociados ?? []).length > 0 && (
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <div className="bg-gray-50 px-3 py-2 flex justify-between items-center">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">BOM — {productoForm.insumosAsociados?.length} insumos</p>
                                        <p className="text-xs font-bold text-teal-700">
                                            Costo base: ${productoForm.insumosAsociados?.reduce((acc, ia) => {
                                                const ins = insumos.find(i => i.id === ia.insumoId);
                                                const factor = parseRendimientoFactor(ins?.rendimiento);
                                                const unitPrice = (ins?.precio ?? 0) / factor;
                                                return acc + (unitPrice * ia.cantidadRequerida);
                                            }, 0).toLocaleString("es-CO")}
                                        </p>
                                    </div>
                                    <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                                        {(productoForm.insumosAsociados ?? []).map((ia, index) => {
                                            const ins = insumos.find(i => i.id === ia.insumoId);
                                            const subtotal = (ins?.precio ?? 0) * ia.cantidadRequerida;
                                            return (
                                                <div key={index} className="flex items-center gap-2 px-3 py-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-gray-800 truncate">{ins?.nombre ?? "Insumo eliminado"}</p>
                                                        <p className="text-[10px] text-gray-400">{ins?.unidad} {subtotal > 0 && `· $${subtotal.toLocaleString()}`}</p>
                                                    </div>
                                                    <Input className="w-20 h-7 text-center text-xs font-bold" type="number" step="0.01" min={0}
                                                        value={ia.cantidadRequerida}
                                                        onChange={e => {
                                                            const newArr = [...(productoForm.insumosAsociados ?? [])];
                                                            newArr[index] = { ...newArr[index], cantidadRequerida: Number(e.target.value) };
                                                            setProductoForm({ ...productoForm, insumosAsociados: newArr });
                                                        }} />
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:bg-red-50"
                                                        onClick={() => {
                                                            const newArr = (productoForm.insumosAsociados ?? []).filter((_, i) => i !== index);
                                                            setProductoForm({ ...productoForm, insumosAsociados: newArr });
                                                        }}>
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <Button onClick={handleSaveProducto}
                                className="h-11 bg-[#183C30] hover:bg-[#122e24] text-white font-bold rounded-xl">
                                Guardar Producto
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* KPIs rápidos */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Con Ficha</p>
                        <p className="text-lg font-black text-gray-900">{globalStats.completos}</p>
                    </div>
                </div>
                <div className={`bg-white rounded-xl border p-3 flex items-center gap-3 ${globalStats.sinFicha > 0 ? "border-amber-200" : "border-gray-100"}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${globalStats.sinFicha > 0 ? "bg-amber-100" : "bg-gray-100"}`}>
                        <AlertCircle className={`w-4 h-4 ${globalStats.sinFicha > 0 ? "text-amber-600" : "text-gray-400"}`} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sin Ficha</p>
                        <p className={`text-lg font-black ${globalStats.sinFicha > 0 ? "text-amber-600" : "text-gray-400"}`}>{globalStats.sinFicha}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                        <DollarSign className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Costo Mat. Total</p>
                        <p className="text-sm font-black text-teal-700">${globalStats.costoTotal.toLocaleString("es-CO")}</p>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex gap-3 items-center bg-white rounded-xl border border-gray-100 p-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input className="pl-9 border-gray-100 text-sm" placeholder="Buscar por nombre, SKU, categoría..."
                        value={searchProductos} onChange={e => setSearchProductos(e.target.value)} />
                </div>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg shrink-0">
                    {(["todos", "completos", "incompletos"] as const).map(mode => (
                        <button key={mode} onClick={() => setFilterMode(mode)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterMode === mode ? "bg-white text-fuchsia-700 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                            {mode === "todos" ? "Todos" : mode === "completos" ? "✓ Con ficha" : "⚠ Sin ficha"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid de productos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProductos.map(p => {
                    const { count, completo, costo, rotos } = getProductStats(p);

                    return (
                        <Card key={p.id} className={`overflow-hidden border transition-shadow hover:shadow-md relative group ${rotos > 0 ? "border-red-200" : completo ? "border-gray-100" : "border-amber-200"}`}>
                            {/* Indicador completitud */}
                            <div className={`h-1 w-full ${rotos > 0 ? "bg-red-400" : completo ? "bg-emerald-400" : "bg-amber-300"}`} />

                            {/* Acciones hover */}
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                                <Button variant="ghost" size="icon" onClick={() => editProducto(p)}
                                    className="text-blue-500 hover:bg-blue-50 h-7 w-7 bg-white shadow-sm border border-gray-100">
                                    <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteProducto(p.id)}
                                    className="text-red-400 hover:bg-red-50 h-7 w-7 bg-white shadow-sm border border-gray-100">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>

                            <CardContent className="p-4 flex flex-col gap-3">
                                <div>
                                    <h3 className="font-bold text-gray-800 pr-14 leading-tight">{p.nombre}</h3>
                                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                                        <span className="bg-fuchsia-50 text-fuchsia-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-fuchsia-100">{p.sku}</span>
                                        {p.categoria && <span className="bg-gray-50 text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-gray-100">{p.categoria}</span>}
                                        {!completo && <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-100">⚠ Sin ficha</span>}
                                        {rotos > 0 && <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-100">⚠ {rotos} insumo(s) eliminado(s)</span>}
                                    </div>
                                </div>

                                {/* BOM resumido */}
                                <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{count} insumos en BOM</p>
                                        {costo > 0 && (
                                            <p className="text-[13px] font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100">
                                                Costo Total: ${costo.toLocaleString("es-CO")}
                                            </p>
                                        )}
                                    </div>
                                    {p.insumosAsociados && p.insumosAsociados.length > 0 ? (
                                        <div className="space-y-0.5">
                                            {p.insumosAsociados.map((ia, idx) => {
                                                const ins = insumos.find(i => i.id === ia.insumoId);
                                                const factor = parseRendimientoFactor(ins?.rendimiento);
                                                const unitPrice = (ins?.precio ?? 0) / factor;
                                                const insSubtotal = unitPrice * ia.cantidadRequerida;
                                                return (
                                                    <div key={idx} className="flex justify-between items-center text-[10px] py-0.5 border-b border-gray-100/50 last:border-0">
                                                        <span className={`truncate max-w-[50%] ${!ins ? "text-red-400 line-through" : "text-gray-600"}`}>
                                                            {ins?.nombre ?? "Insumo eliminado"}
                                                        </span>
                                                        <div className="flex gap-2 items-center shrink-0">
                                                            <span className="font-bold text-gray-400">× {ia.cantidadRequerida} {ins?.unidad ?? ""}</span>
                                                            {insSubtotal > 0 && (
                                                                <span className="text-teal-600 font-bold bg-white px-1 rounded shadow-sm border border-teal-50">
                                                                    ${insSubtotal.toLocaleString("es-CO")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <button onClick={() => editProducto(p)}
                                            className="w-full text-xs text-amber-500 hover:text-amber-700 flex items-center justify-center gap-1 py-1 hover:bg-amber-50 rounded-lg transition-colors">
                                            <Plus className="w-3 h-3" /> Agregar insumos a la ficha técnica
                                        </button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {filteredProductos.length === 0 && (
                    <div className="col-span-full py-16 text-center">
                        <Factory className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">No hay productos que coincidan con los filtros.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
