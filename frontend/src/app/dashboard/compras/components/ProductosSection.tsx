import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Plus, Factory, Edit2, Trash2, X, AlertCircle, CheckCircle2,
    DollarSign, Copy, Filter, Search, FileDown, Layers
} from "lucide-react";
import { ProductoFabricado, Insumo } from "@/hooks/useCompras";
import { exportarBOMPDF, descargarZIPBOMs } from "../utils/pdfExport";
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
        nombre: "", sku: "", descripcion: "", categoria: "", tipo: "Producto", insumosAsociados: [], productosAsociados: []
    });
    const [searchInsumoText, setSearchInsumoText] = useState("");
    const [searchSubProductoText, setSearchSubProductoText] = useState("");
    const [isDownloading, setIsDownloading] = useState(false);

    // ── Calcular costo y completitud ─────────────────────────────────────────
    const getProductStats = (p: ProductoFabricado) => {
        const countInsumos = p.insumosAsociados?.length ?? 0;
        const countProductos = p.productosAsociados?.length ?? 0;
        const completo = countInsumos > 0 || countProductos > 0;

        const mandatory = ["Envase", "Tapa", "Sello", "Etiqueta", "Materia Prima", "Termoencogible", "Caja"];
        const foundCategories = new Set<string>();

        const calcularCostoRecursivo = (prod: ProductoFabricado): number => {
            let costo = 0;
            if (prod.insumosAsociados) {
                for (const ia of prod.insumosAsociados) {
                    const ins = insumos.find(i => i.id === ia.insumoId);
                    if (ins?.clasificacion) foundCategories.add(ins.clasificacion);

                    const factor = parseRendimientoFactor(ins?.rendimiento);
                    const unitPrice = (ins?.precio ?? 0) / factor;
                    costo += unitPrice * ia.cantidadRequerida;
                }
            }
            if (prod.productosAsociados) {
                for (const pa of prod.productosAsociados) {
                    const sp = productos.find(sub => sub.id === pa.productoId);
                    if (sp) {
                        // Si el sub-producto es de una categoría mandatoria (difícil pero posible)
                        // o si su contenido cuenta como Materia Prima
                        costo += calcularCostoRecursivo(sp) * pa.cantidadRequerida;
                    }
                }
            }
            return costo;
        };

        const costo = calcularCostoRecursivo(p);
        const missing = mandatory.filter(m => !foundCategories.has(m));
        const rotos = p.insumosAsociados?.filter(ia => !insumos.find(i => i.id === ia.insumoId)).length ?? 0;

        return { count: countInsumos + countProductos, completo, costo, rotos, missing };
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
    // ── Estadísticas globales ─────────────────────────────────────────────────
    const globalStats = useMemo(() => {
        const stats = productos.map(p => getProductStats(p));
        const completos = stats.filter(s => s.completo).length;
        const sinFicha = productos.length - completos;
        const costoTotal = stats.reduce((acc, s) => acc + s.costo, 0);
        return { completos, sinFicha, costoTotal };
    }, [productos, getProductStats]);

    const handleSaveProducto = async () => {
        if (!productoForm.nombre) return;

        // BARRERA: Evitar productos/kits repetidos (mismo nombre o mismo SKU)
        const duplicate = productos.find(p =>
            (p.nombre.toLowerCase().trim() === (productoForm.nombre ?? "").toLowerCase().trim() ||
                (p.sku && p.sku.trim() !== "" && p.sku.toLowerCase().trim() === (productoForm.sku ?? "").toLowerCase().trim()))
            && p.id !== productoForm.id
        );

        if (duplicate) {
            toast.error(`Ya existe un producto con el nombre "${duplicate.nombre}"${duplicate.sku ? ` o SKU "${duplicate.sku}"` : ""}. No se permiten repetidos.`);
            return;
        }

        const autoSku = productoForm.sku || `PRD-${Math.floor(1000 + Math.random() * 9000)}`;
        const payload = {
            ...productoForm,
            sku: autoSku,
            insumosAsociados: productoForm.insumosAsociados || [],
            productosAsociados: productoForm.productosAsociados || []
        };
        if (productoForm.id) {
            await updateProducto(productoForm.id, payload);
        } else {
            await createProducto(payload);
        }
        setProductoForm({ id: undefined, sku: "", nombre: "", descripcion: "", categoria: "", insumosAsociados: [], productosAsociados: [] });
        setIsProductoDialogOpen(false);
    };

    const editProducto = (p: ProductoFabricado) => {
        setProductoForm({
            ...p,
            tipo: p.tipo || "Producto",
            insumosAsociados: p.insumosAsociados || [],
            productosAsociados: p.productosAsociados || []
        });
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
                        Base de Productos Fabricados / Kits
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">{productos.length} productos · {globalStats.completos} con ficha técnica</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-9 border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50"
                        disabled={isDownloading || productos.length === 0}
                        onClick={async () => {
                            setIsDownloading(true);
                            await descargarZIPBOMs(productos, productos, insumos);
                            setIsDownloading(false);
                        }}>
                        <FileDown className="w-4 h-4 mr-2" />
                        {isDownloading ? "Generando..." : "Bajar Todos (ZIP)"}
                    </Button>
                    <Dialog open={isProductoDialogOpen} onOpenChange={setIsProductoDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl shadow-md shrink-0"
                                onClick={() => setProductoForm({ id: undefined, sku: "", nombre: "", descripcion: "", categoria: "", tipo: "Producto", insumosAsociados: [], productosAsociados: [] })}>
                                <Plus className="w-4 h-4 mr-2" /> Nuevo Producto / Kit
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-slate-800">
                                    {productoForm.id ? "Editar Producto" : "Registrar Producto Fabricado"}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">Tipo de Registro</label>
                                    <div className="flex bg-gray-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setProductoForm({ ...productoForm, tipo: "Producto", productosAsociados: [] })}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${productoForm.tipo === "Producto" ? "bg-white text-fuchsia-700 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                                            <Factory className="w-3.5 h-3.5" /> Ficha de Producto
                                        </button>
                                        <button
                                            onClick={() => setProductoForm({ ...productoForm, tipo: "Kit" })}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${productoForm.tipo === "Kit" ? "bg-white text-violet-700 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                                            <Layers className="w-3.5 h-3.5" /> Kit / Combo
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">SKU (Opcional)</label>
                                        <Input value={productoForm.sku} className="h-10 font-mono"
                                            onChange={e => setProductoForm({ ...productoForm, sku: e.target.value.toUpperCase() })}
                                            placeholder="Autogenerado" />
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre del {productoForm.tipo} *</label>
                                        <Input value={productoForm.nombre} className="h-10 border-fuchsia-100 focus:border-fuchsia-300"
                                            onChange={e => setProductoForm({ ...productoForm, nombre: e.target.value })}
                                            placeholder={productoForm.tipo === "Kit" ? "Ej. Kit Ritual Regalo" : "Ej. Shampoo de Keratina"} />
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

                                {/* Agregar insumos / productos al BOM */}
                                <div className={`grid gap-4 ${productoForm.tipo === "Kit" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                            <Plus className="w-3 h-3" /> Agregar Insumos
                                        </label>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                                            <Input
                                                placeholder="Buscar insumo..."
                                                value={searchInsumoText}
                                                onChange={(e) => setSearchInsumoText(e.target.value)}
                                                className="h-9 pl-8 text-xs border-fuchsia-100 placeholder:text-gray-400"
                                            />
                                        </div>
                                        <div className="border rounded-lg max-h-40 overflow-y-auto bg-gray-50/50">
                                            {insumos
                                                .filter(i =>
                                                    i.nombre.toLowerCase().includes(searchInsumoText.toLowerCase()) ||
                                                    i.sku.toLowerCase().includes(searchInsumoText.toLowerCase())
                                                )
                                                .slice(0, 50)
                                                .map(i => {
                                                    const yaEsta = (productoForm.insumosAsociados ?? []).some(ia => ia.insumoId === i.id);
                                                    return (
                                                        <button key={i.id}
                                                            onClick={() => {
                                                                if (!yaEsta) {
                                                                    setProductoForm({
                                                                        ...productoForm,
                                                                        insumosAsociados: [...(productoForm.insumosAsociados ?? []), { insumoId: i.id, cantidadRequerida: 1 }]
                                                                    });
                                                                }
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-white flex justify-between items-center border-b last:border-0 ${yaEsta ? "opacity-50 cursor-not-allowed bg-emerald-50" : ""}`}>
                                                            <span className="truncate flex-1">
                                                                <span className="font-mono text-[9px] text-gray-400 mr-2">{i.sku}</span>
                                                                {i.nombre}
                                                            </span>
                                                            {yaEsta ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Plus className="w-3 h-3 text-gray-300" />}
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    {productoForm.tipo === "Kit" && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                                <Layers className="w-3 h-3" /> Agregar Productos (Individuales)
                                            </label>
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                                                <Input
                                                    placeholder="Buscar producto..."
                                                    value={searchSubProductoText}
                                                    onChange={(e) => setSearchSubProductoText(e.target.value)}
                                                    className="h-9 pl-8 text-xs border-fuchsia-100 placeholder:text-gray-400"
                                                />
                                            </div>
                                            <div className="border rounded-lg max-h-40 overflow-y-auto bg-gray-50/50">
                                                {productos
                                                    .filter(p => p.id !== productoForm.id) // Evitar autoreferencia
                                                    .filter(p => p.tipo !== "Kit") // Un Kit usualmente es de productos individuales, no kits de kits (evitar loops)
                                                    .filter(p =>
                                                        p.nombre.toLowerCase().includes(searchSubProductoText.toLowerCase()) ||
                                                        (p.sku ?? "").toLowerCase().includes(searchSubProductoText.toLowerCase())
                                                    )
                                                    .map(p => {
                                                        const yaEsta = (productoForm.productosAsociados ?? []).some(pa => pa.productoId === p.id);
                                                        return (
                                                            <button key={p.id}
                                                                onClick={() => {
                                                                    if (!yaEsta) {
                                                                        setProductoForm({
                                                                            ...productoForm,
                                                                            productosAsociados: [...(productoForm.productosAsociados ?? []), { productoId: p.id, cantidadRequerida: 1 }]
                                                                        });
                                                                    }
                                                                }}
                                                                className={`w-full text-left px-3 py-2 text-xs hover:bg-white flex justify-between items-center border-b last:border-0 ${yaEsta ? "opacity-50 cursor-not-allowed bg-violet-50" : ""}`}>
                                                                <span className="truncate flex-1 text-gray-700">
                                                                    <span className="font-mono text-[9px] text-gray-400 mr-2">{p.sku}</span>
                                                                    {p.nombre}
                                                                </span>
                                                                {yaEsta ? <CheckCircle2 className="w-3 h-3 text-violet-500" /> : <Plus className="w-3 h-3 text-gray-300" />}
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Lista de items del BOM actual */}
                                {((productoForm.insumosAsociados ?? []).length > 0 || (productoForm.productosAsociados ?? []).length > 0) && (
                                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                                        <div className="bg-gray-50 px-3 py-2 flex justify-between items-center">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Detalle del BOM</p>
                                        </div>
                                        <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                                            {/* Insumos */}
                                            {(productoForm.insumosAsociados ?? []).map((ia, index) => {
                                                const ins = insumos.find(i => i.id === ia.insumoId);
                                                return (
                                                    <div key={`ins-${index}`} className="flex items-center gap-2 px-3 py-2 bg-white">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-gray-800 truncate">{ins?.nombre ?? "Insumo eliminado"}</p>
                                                            <p className="text-[9px] text-fuchsia-600 font-bold uppercase">Insumo · {ins?.unidad}</p>
                                                        </div>
                                                        <Input className="w-20 h-7 text-center text-xs font-bold" type="number" step="0.01" min={0}
                                                            value={ia.cantidadRequerida}
                                                            onChange={e => {
                                                                const newArr = [...(productoForm.insumosAsociados ?? [])];
                                                                newArr[index] = { ...newArr[index], cantidadRequerida: Number(e.target.value) };
                                                                setProductoForm({ ...productoForm, insumosAsociados: newArr });
                                                            }} />
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-300 hover:text-red-500"
                                                            onClick={() => {
                                                                const newArr = (productoForm.insumosAsociados ?? []).filter((_, i) => i !== index);
                                                                setProductoForm({ ...productoForm, insumosAsociados: newArr });
                                                            }}>
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                            {/* Sub-Productos */}
                                            {(productoForm.productosAsociados ?? []).map((pa, index) => {
                                                const subP = productos.find(p => p.id === pa.productoId);
                                                return (
                                                    <div key={`prod-${index}`} className="flex items-center gap-2 px-3 py-2 bg-violet-50/30">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-gray-800 truncate">{subP?.nombre ?? "Producto eliminado"}</p>
                                                            <p className="text-[9px] text-violet-600 font-bold uppercase">Sub-Producto (Kit)</p>
                                                        </div>
                                                        <Input className="w-20 h-7 text-center text-xs font-bold border-violet-200" type="number" step="1" min={0}
                                                            value={pa.cantidadRequerida}
                                                            onChange={e => {
                                                                const newArr = [...(productoForm.productosAsociados ?? [])];
                                                                newArr[index] = { ...newArr[index], cantidadRequerida: Number(e.target.value) };
                                                                setProductoForm({ ...productoForm, productosAsociados: newArr });
                                                            }} />
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-300 hover:text-red-500"
                                                            onClick={() => {
                                                                const newArr = (productoForm.productosAsociados ?? []).filter((_, i) => i !== index);
                                                                setProductoForm({ ...productoForm, productosAsociados: newArr });
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
                    const { count, completo, costo, rotos, missing } = getProductStats(p);

                    return (
                        <Card key={p.id} className={`overflow-hidden border transition-shadow hover:shadow-md relative group ${rotos > 0 ? "border-red-200" : (completo && missing.length === 0) ? "border-gray-100" : "border-amber-200"}`}>
                            {/* Indicador completitud */}
                            <div className={`h-1 w-full ${rotos > 0 ? "bg-red-400" : (completo && missing.length === 0) ? "bg-emerald-400" : "bg-amber-300"}`} />

                            {/* Acciones hover */}
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                                <Button variant="ghost" size="icon" onClick={() => exportarBOMPDF(p, productos, insumos)}
                                    className="text-fuchsia-600 hover:bg-fuchsia-50 h-7 w-7 bg-white shadow-sm border border-gray-100">
                                    <FileDown className="w-3.5 h-3.5" />
                                </Button>
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
                                        {p.tipo === "Kit" && <span className="bg-violet-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">KIT</span>}
                                        {p.categoria && <span className="bg-gray-50 text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-gray-100">{p.categoria}</span>}
                                        {!completo && <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-100">⚠ Sin ficha</span>}
                                        {rotos > 0 && <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-100">⚠ {rotos} insumo(s) eliminado(s)</span>}
                                    </div>
                                </div>

                                {/* ALERTA DE INTEGRIDAD BOM */}
                                {completo && missing.length > 0 && (
                                    <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-2 flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 text-amber-700">
                                            <AlertCircle className="w-3 h-3" />
                                            <span className="text-[10px] font-black uppercase tracking-tight">Faltan esenciales en ficha:</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {missing.map(m => (
                                                <span key={m} className="bg-white text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-100 shadow-sm lowercase">
                                                    {m}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

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
                                            {p.productosAsociados?.map((pa, idx) => {
                                                const subP = productos.find(sub => sub.id === pa.productoId);
                                                return (
                                                    <div key={`sub-${idx}`} className="flex justify-between items-center text-[10px] py-0.5 border-b border-gray-100/50 last:border-0 italic">
                                                        <span className="truncate max-w-[50%] text-violet-600 font-semibold">
                                                            {subP?.nombre ?? "Producto eliminado"}
                                                        </span>
                                                        <div className="flex gap-2 items-center shrink-0">
                                                            <span className="font-bold text-gray-400">× {pa.cantidadRequerida} kit</span>
                                                            <Layers className="w-2.5 h-2.5 text-violet-400" />
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
