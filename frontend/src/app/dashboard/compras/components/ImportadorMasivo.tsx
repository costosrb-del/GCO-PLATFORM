import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download, UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { parseExcelImport, descargarTemplateExcel, ExcelImportData } from "../utils/excelImport";
import { toast } from "sonner";
import { Insumo, Tercero, ProductoFabricado } from "@/hooks/useCompras";

interface ImportadorMasivoProps {
    createInsumo: (p: Partial<Insumo>) => Promise<any>;
    createTercero: (p: Partial<Tercero>) => Promise<any>;
    createProducto: (p: Partial<ProductoFabricado>) => Promise<any>;
    updateProducto: (id: string, p: Partial<ProductoFabricado>) => Promise<any>;
    insumosExistentes: Insumo[];
    productosExistentes: ProductoFabricado[];
    tercerosExistentes: Tercero[];
}

export const ImportadorMasivo = ({
    createInsumo, createTercero, createProducto, updateProducto,
    insumosExistentes, productosExistentes, tercerosExistentes
}: ImportadorMasivoProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [importData, setImportData] = useState<ExcelImportData | null>(null);
    const [fileName, setFileName] = useState<string>("");

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        try {
            const data = await parseExcelImport(file);
            setImportData(data);
            toast.info(`Excel leído: ${data.insumos.length} insumos, ${data.terceros.length} proveedores y ${data.productos.length} productos detectados.`);
        } catch (err) {
            toast.error("Error al leer el archivo Excel.");
            console.error(err);
        }
    };

    const ejecutarImportacion = async () => {
        if (!importData) return;
        setIsLoading(true);

        try {
            // 1. IMPORTAR INSUMOS
            const createdInsumosMap = new Map<string, string>(); // SKU -> ID
            // Añadir existentes al mapa
            insumosExistentes.forEach(i => createdInsumosMap.set(i.sku, i.id));

            let countInsumos = 0;
            let skippedInsumos = 0;
            for (const row of importData.insumos) {
                if (!row.Nombre) {
                    skippedInsumos++;
                    continue;
                }

                let targetSku = String(row.SKU || "").trim();
                if (!targetSku || targetSku === "-" || targetSku === "0") {
                    targetSku = `INS-${Math.floor(10000 + Math.random() * 90000)}`;
                }

                if (createdInsumosMap.has(targetSku)) {
                    skippedInsumos++;
                    continue; // SKIP si ya existe SKU
                }

                const res = await createInsumo({
                    sku: targetSku,
                    nombre: String(row.Nombre),
                    rendimiento: String(row.Rendimiento ?? "1"),
                    unidad: String(row.Unidad ?? "Unidad"),
                    clasificacion: String(row.Clasificacion ?? "Materia Prima"),
                    precio: Number(row.Precio ?? 0),
                    loteMinimo: Number(row.LoteMinimo ?? 0)
                });
                if (res?.data?.id) createdInsumosMap.set(targetSku, res.data.id);
                countInsumos++;
            }

            // 2. IMPORTAR TERCEROS
            let countTerceros = 0;
            let skippedTerceros = 0;
            for (const row of importData.terceros) {
                if (!row.Nombre || !row.NIT) {
                    skippedTerceros++;
                    continue;
                }
                if (tercerosExistentes.some(t => t.nit === String(row.NIT))) {
                    skippedTerceros++;
                    continue; // SKIP si ya existe NIT
                }

                await createTercero({
                    nombre: String(row.Nombre),
                    nit: String(row.NIT),
                    correo: String(row.Correo || ""),
                    personaContacto: String(row.PersonaContacto || ""),
                    numeroContacto: String(row.NumeroContacto || ""),
                    insumos: String(row.Insumos_SKU || "")
                });
                countTerceros++;
            }

            // 3. IMPORTAR PRODUCTOS (BASE)
            const createdProductosMap = new Map<string, string>(); // SKU -> ID
            productosExistentes.forEach(p => p.sku && createdProductosMap.set(p.sku, p.id));

            let countProductos = 0;
            let skippedProductos = 0;
            for (const row of importData.productos) {
                if (!row.Nombre) {
                    skippedProductos++;
                    continue;
                }
                let targetSku = String(row.SKU || "").trim();
                if (!targetSku || targetSku === "-") {
                    targetSku = `PRD-${Math.floor(10000 + Math.random() * 90000)}`;
                }

                if (createdProductosMap.has(targetSku)) {
                    skippedProductos++;
                    continue;
                }

                const res = await createProducto({
                    sku: targetSku,
                    nombre: String(row.Nombre),
                    categoria: String(row.Categoria || ""),
                    tipo: (row.Tipo === "Kit" ? "Kit" : "Producto"),
                    insumosAsociados: [],
                    productosAsociados: []
                });
                if (res?.data?.id) createdProductosMap.set(targetSku, res.data.id);
                countProductos++;
            }

            // 4. IMPORTAR BOMS (Actualizar productos con sus componentes)
            // Agrupar BOM por SKU_Padre
            const bomGroups = new Map<string, { insumos: any[], productos: any[] }>();
            for (const row of importData.bom) {
                const padre = String(row.SKU_Padre);
                if (!bomGroups.has(padre)) bomGroups.set(padre, { insumos: [], productos: [] });

                if (row.Tipo_Hijo?.toLowerCase() === "insumo") {
                    bomGroups.get(padre)!.insumos.push(row);
                } else {
                    bomGroups.get(padre)!.productos.push(row);
                }
            }

            let countBOMs = 0;
            for (const [skuPadre, components] of bomGroups) {
                const padreId = createdProductosMap.get(skuPadre);
                if (!padreId) continue;

                const insAsociados = components.insumos
                    .map(c => ({
                        insumoId: createdInsumosMap.get(String(c.SKU_Hijo || c.SKU)) || "",
                        cantidadRequerida: Number(c.Cantidad || 0)
                    }))
                    .filter(c => c.insumoId !== "");

                const prodAsociados = components.productos
                    .map(c => ({
                        productoId: createdProductosMap.get(String(c.SKU_Hijo || c.SKU)) || "",
                        cantidadRequerida: Number(c.Cantidad || 0)
                    }))
                    .filter(c => c.productoId !== "");

                await updateProducto(padreId, {
                    insumosAsociados: insAsociados,
                    productosAsociados: prodAsociados
                });
                countBOMs++;
            }

            let feedback = `Importación: ${countInsumos} insumos, ${countTerceros} proveedores, ${countProductos} productos, ${countBOMs} BOMs.`;
            if (skippedInsumos + skippedTerceros + skippedProductos > 0) {
                feedback += ` Se omitieron ${skippedInsumos + skippedTerceros + skippedProductos} duplicados o incompletos.`;
            }

            if (countInsumos + countTerceros + countProductos === 0) {
                toast.warning("No se importó nada. Verifica que los nombres de las pestañas sean correctos o que los SKUs no estén repetidos.");
            } else {
                toast.success(feedback);
            }

            setImportData(null);
            setFileName("");
            setIsOpen(false);
        } catch (err) {
            toast.error("Error durante la importación masiva.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="h-11 border-[#183C30] text-[#183C30] hover:bg-emerald-50 rounded-xl font-bold flex gap-2">
                    <FileSpreadsheet className="w-5 h-5" />
                    Carga Masiva Excel
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <UploadCloud className="w-6 h-6 text-[#183C30]" />
                        Importador GCO v2
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Descarga Template */}
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-blue-800">¿No tienes el formato?</p>
                            <p className="text-[11px] text-blue-600">Descarga la plantilla oficial aquí.</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={descargarTemplateExcel} className="text-blue-700 hover:bg-white/50">
                            <Download className="w-4 h-4 mr-2" /> Template
                        </Button>
                    </div>

                    {/* Selector de Archivo */}
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-emerald-300 transition-colors bg-slate-50 relative group">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileSelect}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                <FileSpreadsheet className="w-6 h-6 text-[#183C30]" />
                            </div>
                            <p className="text-sm font-bold text-slate-700">
                                {fileName || "Seleccionar archivo Excel"}
                            </p>
                            <p className="text-[10px] text-slate-400">Suelta tu archivo .xlsx aquí o haz clic</p>
                        </div>
                    </div>

                    {/* Resumen */}
                    {importData && (
                        <div className="grid grid-cols-2 gap-3 animate-in zoom-in-95">
                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="text-[11px] font-bold text-emerald-800">{importData.insumos.length} Insumos</span>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                <span className="text-[11px] font-bold text-blue-800">{importData.terceros.length} Proveedores</span>
                            </div>
                            <div className="bg-violet-50 p-3 rounded-xl border border-violet-100 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-violet-600" />
                                <span className="text-[11px] font-bold text-violet-800">{importData.productos.length} Productos</span>
                            </div>
                            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                                <span className="text-[11px] font-bold text-amber-800">{importData.bom.length} Líneas BOM</span>
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={ejecutarImportacion}
                        disabled={!importData || isLoading}
                        className="w-full h-12 bg-[#183C30] hover:bg-[#122e24] text-white font-black rounded-xl text-lg shadow-lg"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            "Iniciar Importación"
                        )}
                    </Button>

                    <div className="flex items-center gap-2 px-2">
                        <AlertCircle className="w-4 h-4 text-slate-400" />
                        <p className="text-[10px] text-slate-400 italic">
                            Nota: Los SKUs repetidos se ignorarán para evitar duplicados.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
