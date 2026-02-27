"use client";

import { useState } from "react";
import { useCompras, Tercero, OrdenCompra, Insumo, ProductoFabricado } from "@/hooks/useCompras";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Plus, Building2, ShoppingCart, CheckCircle, FileText, UploadCloud, Trash2, Package, Download, Factory, Edit2, X } from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ComprasPage() {
    const { terceros, ordenes, insumos, productos, isLoading, createTercero, updateTercero, deleteTercero, createOrden, updateOrden, createInsumo, deleteInsumo, createProducto, updateProducto, deleteProducto } = useCompras();
    const [activeTab, setActiveTab] = useState<"terceros" | "ordenes" | "insumos" | "productos">("ordenes");

    // Terceros state
    const [isTerceroDialogOpen, setIsTerceroDialogOpen] = useState(false);
    const [terceroForm, setTerceroForm] = useState<Partial<Tercero>>({
        nombre: "", nit: "", correo: "", personaContacto: "", numeroContacto: "", insumos: ""
    });

    // Ordenes state
    const [isOrdenDialogOpen, setIsOrdenDialogOpen] = useState(false);
    const [ordenForm, setOrdenForm] = useState<Partial<OrdenCompra>>({
        terceroId: "", insumoId: "", insumo: "", cantidad: 0, unidad: "Unidad", estado: "Pendiente", tiempoEntrega: "", fechaSolicitada: format(new Date(), 'yyyy-MM-dd'), numeroPedido: "", notas: "", entregasParciales: ""
    });

    // Insumos state
    const [isInsumoDialogOpen, setIsInsumoDialogOpen] = useState(false);
    const [insumoForm, setInsumoForm] = useState<Partial<Insumo>>({
        sku: "", nombre: "", rendimiento: "", unidad: "Unidad", proveedores: [], clasificacion: "Materia Prima"
    });

    // Productos state
    const [isProductoDialogOpen, setIsProductoDialogOpen] = useState(false);
    const [productoForm, setProductoForm] = useState<Partial<ProductoFabricado>>({
        nombre: "", sku: "", descripcion: "", categoria: "", insumosAsociados: []
    });

    // Search filters
    const [searchTerceros, setSearchTerceros] = useState("");
    const [searchOrdenes, setSearchOrdenes] = useState("");
    const [searchInsumos, setSearchInsumos] = useState("");
    const [searchProductos, setSearchProductos] = useState("");

    // Receipt logic
    const [uploadingFile, setUploadingFile] = useState(false);

    // ---- TERCEROS ----
    const handleSaveTercero = async () => {
        if (!terceroForm.nombre || !terceroForm.nit) return;

        let insText = "";
        if (terceroForm.insumosPrecios && terceroForm.insumosPrecios.length > 0) {
            insText = terceroForm.insumosPrecios.map(ip => {
                const insData = insumos.find(i => i.id === ip.insumoId);
                return `[${insData?.sku}] ${insData?.nombre} ($${ip.precio})`;
            }).join(', ');
        }

        const dataToSave = {
            ...terceroForm,
            insumos: insText || terceroForm.insumos || ""
        };

        if (terceroForm.id) {
            await updateTercero(terceroForm.id, dataToSave);
        } else {
            await createTercero(dataToSave);
        }

        setTerceroForm({ id: undefined, nombre: "", nit: "", correo: "", personaContacto: "", numeroContacto: "", insumos: "", insumosPrecios: [] });
        setIsTerceroDialogOpen(false);
    };

    const editTercero = (t: Tercero) => {
        setTerceroForm({ ...t });
        setIsTerceroDialogOpen(true);
    };

    // ---- ORDENES ----
    const handleSaveOrden = async () => {
        if (!ordenForm.terceroId || !ordenForm.insumoId || !ordenForm.cantidad) return;
        const insumoSeleccionado = insumos.find(i => i.id === ordenForm.insumoId);
        if (!insumoSeleccionado) return;

        await createOrden({
            ...ordenForm,
            insumo: insumoSeleccionado.nombre
        });
        setOrdenForm({ terceroId: "", insumoId: "", insumo: "", cantidad: 0, unidad: "Unidad", estado: "Pendiente", tiempoEntrega: "" });
        setIsOrdenDialogOpen(false);
    };

    const handleReceiveOrder = async (ordenId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingFile(true);

        try {
            const fileRef = ref(storage, `compras_recibos/${ordenId}_${file.name}`);
            const uploadTask = uploadBytesResumable(fileRef, file);

            uploadTask.on('state_changed',
                () => { },
                (err) => { console.error(err); setUploadingFile(false); },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    await updateOrden(ordenId, {
                        estado: "Recibido",
                        comprobanteUrl: downloadURL,
                        fechaMovimiento: new Date().toISOString()
                    });
                    setUploadingFile(false);
                }
            );
        } catch (err) {
            console.error(err);
            setUploadingFile(false);
        }
    };

    const handleSaveInsumo = async () => {
        if (!insumoForm.nombre) return;
        const autoSku = insumoForm.sku || `INS-${Math.floor(1000 + Math.random() * 9000)}`;
        await createInsumo({ ...insumoForm, sku: autoSku });
        setInsumoForm({ sku: "", nombre: "", rendimiento: "", unidad: "Unidad", proveedores: [] });
        setIsInsumoDialogOpen(false);
    };

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

    const exportarOrdenPDF = (orden: OrdenCompra, tercero: Tercero) => {
        const doc = new jsPDF();

        // Header
        doc.setFillColor(24, 60, 48); // GCO color
        doc.rect(0, 0, 210, 40, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("ORDEN DE COMPRA GCO", 14, 25);

        doc.setFontSize(10);
        doc.text(`Fecha: ${format(new Date(orden.created_at || new Date()), "dd/MM/yyyy")}`, 150, 20);
        doc.text(`ID Orden: ${orden.id.substring(0, 8).toUpperCase()}`, 150, 26);

        // Proveedor Info
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.text("Datos del Proveedor", 14, 55);
        doc.setFontSize(10);
        doc.text(`Razón Social: ${tercero.nombre}`, 14, 63);
        doc.text(`NIT / Documento: ${tercero.nit}`, 14, 69);
        doc.text(`Contacto: ${tercero.personaContacto} - ${tercero.numeroContacto}`, 14, 75);
        doc.text(`Correo: ${tercero.correo}`, 14, 81);

        // Orden de compra Detalle
        doc.setFontSize(14);
        doc.text("Detalle de la Orden", 14, 100);

        autoTable(doc, {
            startY: 105,
            head: [["Insumo / Producto", "SKU Ref", "Cantidad", "Unidad", "Est. Unitario ($)", "Tiempo Requerido"]],
            body: [[
                orden.insumo,
                insumos.find(i => i.id === orden.insumoId)?.sku || "N/A",
                orden.cantidad.toString(),
                orden.unidad,
                `$${(orden.precio_estimado || 0).toLocaleString()}`,
                orden.tiempoEntrega || "A convenir"
            ]],
            theme: 'grid',
            headStyles: { fillColor: [24, 60, 48], textColor: [255, 255, 255] }
        });

        let finalY = (doc as any).lastAutoTable.finalY + 10;

        // Información Adicional del Pedido
        if (orden.numeroPedido || orden.fechaSolicitada || orden.entregasParciales || orden.notas) {
            doc.setFontSize(14);
            doc.setTextColor(30, 30, 30);
            doc.text("Información Adicional", 14, finalY);
            finalY += 8;
            doc.setFontSize(10);
            if (orden.numeroPedido) {
                doc.text(`Número de Pedido Interno: ${orden.numeroPedido}`, 14, finalY);
                finalY += 6;
            }
            if (orden.fechaSolicitada) {
                doc.text(`Fecha Solicitada para entrega: ${format(new Date(orden.fechaSolicitada), "dd/MM/yyyy")}`, 14, finalY);
                finalY += 6;
            }
            if (orden.entregasParciales) {
                doc.text(`Fases de Entregas Parciales: ${orden.entregasParciales}`, 14, finalY);
                finalY += 6;
            }
            if (orden.notas) {
                doc.setFont("helvetica", "italic");
                const splitNotes = doc.splitTextToSize(`Notas Adicionales: ${orden.notas}`, 180);
                doc.text(splitNotes, 14, finalY);
                finalY += (splitNotes.length * 5) + 2;
                doc.setFont("helvetica", "normal");
            }
            finalY += 10;
        }

        // Totales Estimados
        doc.setFontSize(12);
        doc.setTextColor(24, 60, 48);
        doc.text(`Valor Estimado Total: $${((orden.cantidad) * (orden.precio_estimado || 0)).toLocaleString()}`, 130, finalY);

        // Firmas y notas
        finalY = finalY + 30;
        doc.setTextColor(30, 30, 30);
        doc.text("_________________________", 14, finalY);
        doc.text("GCO Platform - Solicitante", 14, finalY + 5);

        doc.save(`Orden_Compra_${tercero.nombre.replace(/ /g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-50/50">
                <div className="w-8 h-8 border-4 border-[#183C30]/20 border-t-[#183C30] rounded-full animate-spin"></div>
            </div>
        );
    }

    const filteredTerceros = terceros.filter(t =>
        t.nombre.toLowerCase().includes(searchTerceros.toLowerCase()) ||
        t.nit.includes(searchTerceros) ||
        (t.insumos || "").toLowerCase().includes(searchTerceros.toLowerCase()) ||
        (t.personaContacto || "").toLowerCase().includes(searchTerceros.toLowerCase()) ||
        (t.correo || "").toLowerCase().includes(searchTerceros.toLowerCase())
    );
    const filteredOrdenes = ordenes.filter(o => {
        const t = terceros.find(terc => terc.id === o.terceroId);
        return o.insumo.toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            o.estado.toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            (t?.nombre || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            (o.id || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            (o.numeroPedido || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            (o.notas || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            (o.fechaSolicitada || "").toLowerCase().includes(searchOrdenes.toLowerCase());
    });
    const filteredProductos = productos.filter(p =>
        p.nombre.toLowerCase().includes(searchProductos.toLowerCase()) ||
        (p.sku || "").toLowerCase().includes(searchProductos.toLowerCase()) ||
        (p.categoria || "").toLowerCase().includes(searchProductos.toLowerCase())
    );
    const filteredInsumos = insumos.filter(i =>
        i.nombre.toLowerCase().includes(searchInsumos.toLowerCase()) ||
        i.sku.toLowerCase().includes(searchInsumos.toLowerCase()) ||
        (i.rendimiento || "").toLowerCase().includes(searchInsumos.toLowerCase()) ||
        (i.clasificacion || "").toLowerCase().includes(searchInsumos.toLowerCase()) ||
        (i.unidad || "").toLowerCase().includes(searchInsumos.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50/50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ShoppingCart className="w-7 h-7 text-[#183C30]" />
                            Gestión de Compras
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 font-medium">
                            Control de terceros, proveedores y órdenes de compra de insumos.
                        </p>
                    </div>

                    <div className="flex bg-gray-100/80 p-1.5 rounded-xl self-start md:self-auto">
                        <button
                            onClick={() => setActiveTab("ordenes")}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === "ordenes" ? "bg-white text-[#183C30] shadow-sm transform scale-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                        >
                            Órdenes de Compra
                        </button>
                        <button
                            onClick={() => setActiveTab("terceros")}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === "terceros" ? "bg-white text-[#183C30] shadow-sm transform scale-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                        >
                            Terceros y Proveedores
                        </button>
                        <button
                            onClick={() => setActiveTab("insumos")}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === "insumos" ? "bg-white text-[#183C30] shadow-sm transform scale-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                        >
                            Base de Insumos
                        </button>
                        <button
                            onClick={() => setActiveTab("productos")}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === "productos" ? "bg-white text-[#183C30] shadow-sm transform scale-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                        >
                            Productos Fabricados
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                {activeTab === "terceros" ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-indigo-600" />
                                Base de Datos de Terceros
                            </h2>
                            <div className="flex w-full md:w-auto items-center gap-3">
                                <Input
                                    className="max-w-xs bg-white rounded-xl shadow-sm border-gray-100 placeholder:text-gray-400"
                                    placeholder="Buscar por Nombre, NIT o Insumos..."
                                    value={searchTerceros}
                                    onChange={(e) => setSearchTerceros(e.target.value)}
                                />
                                <Dialog open={isTerceroDialogOpen} onOpenChange={setIsTerceroDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Nuevo Proveedor
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[450px]">
                                        <DialogHeader>
                                            <DialogTitle>Registrar Tercero / Proveedor</DialogTitle>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Nombre o Razón Social</label>
                                                <Input value={terceroForm.nombre} onChange={e => setTerceroForm({ ...terceroForm, nombre: e.target.value })} placeholder="Ej. Distribuidora S.A" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">NIT o Documento</label>
                                                <Input value={terceroForm.nit} onChange={e => setTerceroForm({ ...terceroForm, nit: e.target.value })} placeholder="Ej. 900.123.456-7" />
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="space-y-1 flex-1">
                                                    <label className="text-xs font-semibold text-gray-600">Persona de Contacto</label>
                                                    <Input value={terceroForm.personaContacto} onChange={e => setTerceroForm({ ...terceroForm, personaContacto: e.target.value })} placeholder="Nombre" />
                                                </div>
                                                <div className="space-y-1 flex-1">
                                                    <label className="text-xs font-semibold text-gray-600">Número</label>
                                                    <Input value={terceroForm.numeroContacto} onChange={e => setTerceroForm({ ...terceroForm, numeroContacto: e.target.value })} placeholder="Teléfono" />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Correo Electrónico</label>
                                                <Input type="email" value={terceroForm.correo} onChange={e => setTerceroForm({ ...terceroForm, correo: e.target.value })} placeholder="contacto@empresa.com" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">¿Qué insumos vende?</label>
                                                <div className="flex flex-col gap-2">
                                                    <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gray-50 flex flex-wrap gap-2">
                                                        {insumos.map(i => {
                                                            const isSelected = terceroForm.insumos?.toLowerCase().includes(`[${i.sku}]`);
                                                            return (
                                                                <div
                                                                    key={i.id}
                                                                    onClick={() => {
                                                                        const currentVal = terceroForm.insumos || "";
                                                                        if (isSelected) {
                                                                            setTerceroForm({ ...terceroForm, insumos: currentVal.replace(`[${i.sku}] ${i.nombre}, `, "") });
                                                                        } else {
                                                                            setTerceroForm({ ...terceroForm, insumos: currentVal + `[${i.sku}] ${i.nombre}, ` });
                                                                        }
                                                                    }}
                                                                    className={`px-3 py-1 cursor-pointer text-[10px] sm:text-xs rounded-full border transition-all ${isSelected ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                                                >
                                                                    {i.sku} - {i.nombre}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                    <Input value={terceroForm.insumos} onChange={e => setTerceroForm({ ...terceroForm, insumos: e.target.value })} placeholder="Seleccione arriba o escriba manualmente..." className="text-sm" />
                                                </div>
                                            </div>
                                            <Button onClick={handleSaveTercero} className="mt-4 bg-[#183C30] hover:bg-[#122e24]">Guardar Proveedor</Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="grid grid-cols-[2fr_1.5fr_1.5fr_2fr_auto] p-4 bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                                <div>Proveedor</div>
                                <div>Contacto</div>
                                <div>Teléfono</div>
                                <div>Insumos Autorizados</div>
                                <div className="w-[80px] text-center">Acciones</div>
                            </div>
                            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                                {filteredTerceros.map(t => (
                                    <div key={t.id} className="grid grid-cols-[2fr_1.5fr_1.5fr_2fr_auto] p-4 items-center hover:bg-slate-50 transition-colors group">
                                        <div>
                                            <p className="font-semibold text-gray-800 text-sm">{t.nombre}</p>
                                            <p className="text-xs text-gray-500 font-medium font-mono">NIT: {t.nit}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 truncate">{t.personaContacto}</p>
                                            <p className="text-xs text-gray-500 truncate">{t.correo}</p>
                                        </div>
                                        <div className="text-sm text-gray-700">
                                            {t.numeroContacto}
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600 max-w-[200px] truncate" title={t.insumos}>{t.insumos}</p>
                                        </div>
                                        <div className="w-[80px] flex justify-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => editTercero(t)} className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => deleteTercero(t.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {filteredTerceros.length === 0 && (
                                    <div className="p-10 text-center text-gray-500">
                                        No hay proveedores que coincidan con la búsqueda.
                                    </div>
                                )}
                            </div>
                        </div>


                    </div>
                ) : activeTab === "ordenes" ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-600" />
                                Solicitudes y Órdenes
                            </h2>
                            <div className="flex w-full md:w-auto items-center gap-3">
                                <Input
                                    className="max-w-xs bg-white rounded-xl shadow-sm border-gray-100 placeholder:text-gray-400"
                                    placeholder="Buscar por Insumo o Estado..."
                                    value={searchOrdenes}
                                    onChange={(e) => setSearchOrdenes(e.target.value)}
                                />
                                <Dialog open={isOrdenDialogOpen} onOpenChange={setIsOrdenDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Nueva Orden
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[450px]">
                                        <DialogHeader>
                                            <DialogTitle>Crear Orden de Compra</DialogTitle>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Proveedor</label>
                                                <Select value={ordenForm.terceroId} onValueChange={v => setOrdenForm({ ...ordenForm, terceroId: v })}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccione proveedor" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {terceros.map(t => (
                                                            <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Insumo / Producto a pedir</label>
                                                <Select value={ordenForm.insumoId} onValueChange={v => {
                                                    const selectedInsumo = insumos.find(i => i.id === v);
                                                    const provSelect = terceros.find(t => t.id === ordenForm.terceroId);
                                                    const precioProv = provSelect?.insumosPrecios?.find(ip => ip.insumoId === v)?.precio || selectedInsumo?.precio || 0;
                                                    setOrdenForm({
                                                        ...ordenForm,
                                                        insumoId: v,
                                                        unidad: selectedInsumo?.unidad || "Unidad",
                                                        precio_estimado: precioProv
                                                    });
                                                }} disabled={!ordenForm.terceroId}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={!ordenForm.terceroId ? "Seleccione un proveedor primero" : "Seleccione Insumo Registrado"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {insumos.filter(i => {
                                                            if (!ordenForm.terceroId) return false;
                                                            const prov = terceros.find(t => t.id === ordenForm.terceroId);
                                                            if (!prov) return false;
                                                            return (prov.insumos || "").toLowerCase().includes(`[${i.sku.toLowerCase()}]`);
                                                        }).map(i => {
                                                            const prov = terceros.find(t => t.id === ordenForm.terceroId);
                                                            const currentPx = prov?.insumosPrecios?.find(ip => ip.insumoId === i.id)?.precio;
                                                            if (currentPx !== undefined) {
                                                                return (
                                                                    <SelectItem key={i.id} value={i.id} className="text-indigo-700 font-medium bg-indigo-50/30">
                                                                        ★ {i.sku} - {i.nombre} (${currentPx.toLocaleString()})
                                                                    </SelectItem>
                                                                );
                                                            }
                                                            return (
                                                                <SelectItem key={i.id} value={i.id}>{i.sku} - {i.nombre}</SelectItem>
                                                            )
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="space-y-1 flex-1">
                                                    <label className="text-xs font-semibold text-gray-600">No. de Pedido</label>
                                                    <Input value={ordenForm.numeroPedido || ''} onChange={e => setOrdenForm({ ...ordenForm, numeroPedido: e.target.value })} placeholder="Ej. PED-2023-01" />
                                                </div>
                                                <div className="space-y-1 flex-1">
                                                    <label className="text-xs font-semibold text-gray-600">Fecha Solicitada</label>
                                                    <Input type="date" value={ordenForm.fechaSolicitada || ''} onChange={e => setOrdenForm({ ...ordenForm, fechaSolicitada: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="space-y-1 flex-1">
                                                    <label className="text-xs font-semibold text-gray-600">Val. Unitario ($)</label>
                                                    <Input type="number" value={ordenForm.precio_estimado || ''} onChange={e => setOrdenForm({ ...ordenForm, precio_estimado: Number(e.target.value) })} />
                                                </div>
                                                <div className="space-y-1 flex-1">
                                                    <label className="text-xs font-semibold text-gray-600">Cant. / Und.</label>
                                                    <div className="flex gap-2">
                                                        <Input className="flex-1" type="number" value={ordenForm.cantidad || ''} onChange={e => setOrdenForm({ ...ordenForm, cantidad: Number(e.target.value) })} />
                                                        <Select value={ordenForm.unidad} onValueChange={v => setOrdenForm({ ...ordenForm, unidad: v })}>
                                                            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Unidad">Und</SelectItem>
                                                                <SelectItem value="Kilogramo">Kg</SelectItem>
                                                                <SelectItem value="Litro">Lt</SelectItem>
                                                                <SelectItem value="Caja">Caja</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="space-y-1 flex-1">
                                                    <label className="text-xs font-semibold text-gray-600">Tiempo de Entrega</label>
                                                    <Input value={ordenForm.tiempoEntrega} onChange={e => setOrdenForm({ ...ordenForm, tiempoEntrega: e.target.value })} placeholder="Ej. 3 días hábiles" />
                                                </div>
                                                <div className="space-y-1 flex-1">
                                                    <label className="text-xs font-semibold text-gray-600">Entregas Parciales</label>
                                                    <Input value={ordenForm.entregasParciales || ''} onChange={e => setOrdenForm({ ...ordenForm, entregasParciales: e.target.value })} placeholder="Opcional." />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Notas Adicionales</label>
                                                <Input value={ordenForm.notas || ''} onChange={e => setOrdenForm({ ...ordenForm, notas: e.target.value })} placeholder="Ej. Entregar en portería principal" />
                                            </div>

                                            <Button onClick={handleSaveOrden} className="mt-4 bg-[#183C30] hover:bg-[#122e24]">Generar Orden</Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] p-4 bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                                <div>Detalle</div>
                                <div>Proveedor</div>
                                <div className="text-center">Cantidad</div>
                                <div className="text-center">Estimado</div>
                                <div className="text-center">Estado</div>
                                <div className="w-[140px] text-center">Acciones</div>
                            </div>
                            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                                {filteredOrdenes.map(o => {
                                    const tercero = terceros.find(t => t.id === o.terceroId);
                                    const isRecibido = o.estado === "Recibido";
                                    return (
                                        <div key={o.id} className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] p-4 items-center hover:bg-slate-50 transition-colors">
                                            <div>
                                                <p className="font-semibold text-gray-800 text-sm">{o.insumo}</p>
                                                {o.created_at && <p className="text-xs text-gray-400">Creada: {format(new Date(o.created_at), 'dd/MM/yyyy')}</p>}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">{tercero?.nombre || "Desconocido"}</p>
                                                <p className="text-xs text-gray-500">NIT: {tercero?.nit}</p>
                                            </div>
                                            <div className="text-center font-bold text-gray-700 text-sm">
                                                {o.cantidad} <span className="text-xs font-normal text-gray-500">{o.unidad}</span>
                                            </div>
                                            <div className="text-center font-bold text-teal-700 text-sm">
                                                ${((o.precio_estimado || 0) * o.cantidad).toLocaleString()}
                                            </div>
                                            <div className="flex justify-center">
                                                <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 w-max ${isRecibido ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {isRecibido ? <CheckCircle className="w-3 h-3" /> : <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                                    {o.estado}
                                                </span>
                                            </div>
                                            <div className="w-[140px] flex justify-center gap-2">
                                                {!isRecibido ? (
                                                    <div className="flex gap-1 justify-center items-center">
                                                        <div className="relative flex-1">
                                                            <Input
                                                                type="file"
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                onChange={(e) => handleReceiveOrder(o.id, e)}
                                                                disabled={uploadingFile}
                                                                accept="image/*,.pdf"
                                                                title="Subir Comprobante / Recibir"
                                                            />
                                                            <Button size="sm" variant="outline" className={`h-8 w-full ${uploadingFile ? 'opacity-50' : ''}`}>
                                                                <UploadCloud className="w-4 h-4 md:mr-2" />
                                                                <span className="hidden md:inline">{uploadingFile ? 'Subiendo' : 'Recibir'}</span>
                                                            </Button>
                                                        </div>
                                                        <Button size="icon" variant="outline" className="h-8 w-8 text-indigo-600 hover:text-indigo-700 flex-shrink-0" onClick={() => exportarOrdenPDF(o, tercero || {} as Tercero)} title="Descargar PDF de Orden">
                                                            <Download className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-1 justify-center items-center">
                                                        <Button size="sm" variant="ghost" asChild className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex-1">
                                                            <a href={o.comprobanteUrl} target="_blank" rel="noreferrer">
                                                                <FileText className="w-4 h-4 md:mr-2" />
                                                                <span className="hidden md:inline">Ver Factura</span>
                                                            </a>
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 flex-shrink-0" onClick={() => exportarOrdenPDF(o, tercero || {} as Tercero)} title="Descargar PDF">
                                                            <Download className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredOrdenes.length === 0 && (
                                    <div className="p-10 text-center text-gray-500">
                                        No hay órdenes de compra que coincidan con la búsqueda.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : activeTab === "insumos" ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Package className="w-5 h-5 text-teal-600" />
                                Base de Datos de Insumos (SKUs)
                            </h2>
                            <div className="flex w-full md:w-auto items-center gap-3">
                                <Input
                                    className="max-w-xs bg-white rounded-xl shadow-sm border-gray-100 placeholder:text-gray-400"
                                    placeholder="Buscar por Nombre o SKU..."
                                    value={searchInsumos}
                                    onChange={(e) => setSearchInsumos(e.target.value)}
                                />
                                <Dialog open={isInsumoDialogOpen} onOpenChange={setIsInsumoDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Nuevo Insumo
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[450px]">
                                        <DialogHeader>
                                            <DialogTitle>Registrar Nuevo Insumo</DialogTitle>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">SKU / Código Interno (Opcional)</label>
                                                <Input value={insumoForm.sku} onChange={e => setInsumoForm({ ...insumoForm, sku: e.target.value.toUpperCase() })} placeholder="Autogenerado si está vacío" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Nombre del Insumo</label>
                                                <Input value={insumoForm.nombre} onChange={e => setInsumoForm({ ...insumoForm, nombre: e.target.value })} placeholder="Ej. Alcohol Extra Neutro" />
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="space-y-1 flex-1">
                                                    <label className="text-xs font-semibold text-gray-600">Unidad de Medida</label>
                                                    <Select value={insumoForm.unidad} onValueChange={v => setInsumoForm({ ...insumoForm, unidad: v })}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Unidad">Unidad</SelectItem>
                                                            <SelectItem value="Litro">Litros</SelectItem>
                                                            <SelectItem value="Kilogramo">Kilogramos</SelectItem>
                                                            <SelectItem value="Metro">Metros</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1 flex-1">
                                                    <label className="text-xs font-semibold text-gray-600">Rendimiento (Manufactura)</label>
                                                    <Input value={insumoForm.rendimiento} onChange={e => setInsumoForm({ ...insumoForm, rendimiento: e.target.value })} placeholder="Ej. Rinde 50 unds" />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-semibold text-gray-600">Clasificación</label>
                                                <Select value={insumoForm.clasificacion || "Materia Prima"} onValueChange={v => setInsumoForm({ ...insumoForm, clasificacion: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                                                        <SelectItem value="Otro">Otro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button onClick={handleSaveInsumo} className="mt-4 bg-[#183C30] hover:bg-[#122e24]">Guardar Insumo</Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredInsumos.map(i => (
                                <Card key={i.id} className="overflow-hidden border-gray-100 hover:shadow-md transition-shadow relative group">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" onClick={() => deleteInsumo(i.id)} className="text-red-500 hover:bg-red-50">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <CardContent className="p-5 flex flex-col gap-3">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg">{i.nombre}</h3>
                                            <span className="bg-teal-50 text-teal-700 text-xs font-bold px-2 py-1 rounded-md border border-teal-100 mt-1 inline-block mr-1">SKU: {i.sku}</span>
                                            <span className="bg-orange-50 text-orange-700 text-xs font-bold px-2 py-1 rounded-md border border-orange-100 mt-1 inline-block">{i.clasificacion || 'Materia Prima'}</span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl space-y-2 border border-gray-100 mt-2">
                                            <div className="text-sm">
                                                <span className="text-gray-500 block mb-1">Rendimiento Registrado:</span>
                                                <span className="font-semibold text-gray-700 text-sm">{i.rendimiento || 'No especificado'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                                                <span className="text-gray-500">Unidad Default:</span>
                                                <span className="font-semibold text-gray-700">{i.unidad}</span>
                                            </div>
                                            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                                                <span className="text-gray-500">Precio Proveedor:</span>
                                                <span className="font-bold text-teal-700">${(i.precio || 0).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {filteredInsumos.length === 0 && (
                                <div className="col-span-full py-16 text-center text-gray-500">
                                    No hay insumos registrados que coincidan con la búsqueda.
                                </div>
                            )}
                        </div>
                    </div >
                ) : (
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
                                                <Select onValueChange={v => {
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
                )}
            </div>
        </div>
    );
}
