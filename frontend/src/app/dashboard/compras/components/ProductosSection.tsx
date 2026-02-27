import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Factory, Edit2, Trash2, X } from "lucide-react";
import { ProductoFabricado, Insumo } from "@/hooks/useCompras";

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
    const [productoForm, setProductoForm] = useState<Partial<ProductoFabricado>>({
        nombre: "", sku: "", descripcion: "", categoria: "", insumosAsociados: []
    });

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

    const filteredProductos = productos.filter(p =>
        p.nombre.toLowerCase().includes(searchProductos.toLowerCase()) ||
        (p.sku || "").toLowerCase().includes(searchProductos.toLowerCase()) ||
        (p.categoria || "").toLowerCase().includes(searchProductos.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Factory className="w-5 h-5 text-fuchsia-600" />
                    Base de Productos Fabricados
                </h2>
                <div className="flex w-full md:w-auto items-center gap-3">
                    <Input
                        className="max-w-xs bg-white rounded-xl shadow-sm border-gray-100 placeholder:text-gray-400"
                        placeholder="Buscar por Nombre o SKU..."
                        value={searchProductos}
                        onChange={(e) => setSearchProductos(e.target.value)}
                    />
                    <Dialog open={isProductoDialogOpen} onOpenChange={setIsProductoDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl shadow-md">
                                <Plus className="w-4 h-4 mr-2" />
                                Nuevo Producto
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[450px]">
                            <DialogHeader>
                                <DialogTitle>Registrar Producto Fabricado</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600">SKU / Código (Opcional)</label>
                                    <Input value={productoForm.sku} onChange={e => setProductoForm({ ...productoForm, sku: e.target.value.toUpperCase() })} placeholder="Autogenerado si está vacío" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600">Nombre del Producto</label>
                                    <Input value={productoForm.nombre} onChange={e => setProductoForm({ ...productoForm, nombre: e.target.value })} placeholder="Ej. Crema Facial 500g" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600">Fórmula Mágica (Insumos requeridos)</label>
                                    <Select value="" onValueChange={v => {
                                        const existe = productoForm.insumosAsociados?.find(ia => ia.insumoId === v);
                                        if (!existe) {
                                            const current = productoForm.insumosAsociados || [];
                                            setProductoForm({ ...productoForm, insumosAsociados: [...current, { insumoId: v, cantidadRequerida: 1 }] });
                                        }
                                    }}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar un insumo..." /></SelectTrigger>
                                        <SelectContent>
                                            {insumos.map(i => (
                                                <SelectItem key={i.id} value={i.id}>{i.sku} - {i.nombre} (${(i.precio || 0).toLocaleString()})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(productoForm.insumosAsociados || []).length > 0 && (
                                    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 flex flex-col gap-2 max-h-40 overflow-y-auto">
                                        {(productoForm.insumosAsociados || []).map((ia, index) => {
                                            const insName = insumos.find(i => i.id === ia.insumoId)?.nombre || "Insumo";
                                            return (
                                                <div key={index} className="flex gap-2 items-center">
                                                    <span className="text-xs flex-1 truncate">{insName}</span>
                                                    <Input
                                                        className="w-20 text-xs h-7" type="number" step="0.01" value={ia.cantidadRequerida}
                                                        onChange={e => {
                                                            const newArr = [...(productoForm.insumosAsociados || [])];
                                                            newArr[index].cantidadRequerida = Number(e.target.value);
                                                            setProductoForm({ ...productoForm, insumosAsociados: newArr });
                                                        }}
                                                    />
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => {
                                                        const newArr = (productoForm.insumosAsociados || []).filter((_, i) => i !== index);
                                                        setProductoForm({ ...productoForm, insumosAsociados: newArr });
                                                    }}><X className="w-3 h-3" /></Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <Button onClick={handleSaveProducto} className="mt-4 bg-[#183C30] hover:bg-[#122e24]">Guardar Producto</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProductos.map(p => (
                    <Card key={p.id} className="overflow-hidden border-gray-100 hover:shadow-md transition-shadow relative group">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => editProducto(p)} className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 h-8 w-8">
                                <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteProducto(p.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                        <CardContent className="p-5 flex flex-col gap-3">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">{p.nombre}</h3>
                                <span className="bg-fuchsia-50 text-fuchsia-700 text-xs font-bold px-2 py-1 rounded-md border border-fuchsia-100 mt-1 inline-block mr-1">SKU: {p.sku}</span>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl space-y-2 border border-gray-100 mt-2">
                                <div className="text-sm">
                                    <span className="text-gray-500 block mb-1">Insumos Asociados:</span>
                                    {p.insumosAsociados && p.insumosAsociados.length > 0 ? (
                                        <ul className="list-disc pl-4 text-xs font-semibold text-gray-700">
                                            {p.insumosAsociados.map((ia, idx) => {
                                                const ins = insumos.find(i => i.id === ia.insumoId);
                                                return <li key={idx}>{ins?.nombre || 'Desconocido'} x {ia.cantidadRequerida}</li>
                                            })}
                                        </ul>
                                    ) : (
                                        <span className="font-semibold text-gray-700 text-sm">Ninguno</span>
                                    )}
                                </div>
                                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                                    <span className="text-gray-500">Costo Base Materiales:</span>
                                    <span className="font-bold text-teal-700">${(
                                        p.insumosAsociados?.reduce((acc, ia) => {
                                            const ins = insumos.find(i => i.id === ia.insumoId);
                                            return acc + ((ins?.precio || 0) * ia.cantidadRequerida);
                                        }, 0) || 0
                                    ).toLocaleString()}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {filteredProductos.length === 0 && (
                    <div className="col-span-full py-16 text-center text-gray-500">
                        No hay productos fabricados registrados que coincidan con la búsqueda.
                    </div>
                )}
            </div>
        </div>
    );
};
