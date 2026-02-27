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
    const { terceros, ordenes, insumos, productos, isLoading, createTercero, updateTercero, deleteTercero, createOrden, updateOrden, deleteOrden, createInsumo, deleteInsumo, createProducto, updateProducto, deleteProducto } = useCompras();
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
    // State for multiple order items
    const [orderItems, setOrderItems] = useState<Array<{ insumoId: string; cantidad: number; unidad: string; precio_estimado: number }>>([
        { insumoId: "", cantidad: 0, unidad: "Unidad", precio_estimado: 0 }
    ]);

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
    // NEW filters for orders
    const [filterProviderId, setFilterProviderId] = useState("");
    const [filterInsumoId, setFilterInsumoId] = useState("");
    const [filterPedidoNum, setFilterPedidoNum] = useState("");

    const [viewingOrden, setViewingOrden] = useState<OrdenCompra | null>(null);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

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
        // Validate provider selected
        if (!ordenForm.terceroId) return;

        // If editing an existing order
        // Ensure at least one item is filled
        const validItems = orderItems.filter(it => it.insumoId && it.cantidad > 0);
        if (validItems.length === 0) return;

        const itemsToSave = validItems.map(it => {
            const ins = insumos.find(i => i.id === it.insumoId);
            return { ...it, insumo: ins?.nombre || "" };
        });

        const summaryLabel = itemsToSave.length > 1
            ? `${itemsToSave[0].insumo} +${itemsToSave.length - 1} más`
            : itemsToSave[0].insumo;

        const totalQty = itemsToSave.reduce((sum, i) => sum + i.cantidad, 0);
        const totalBruto = itemsToSave.reduce((sum, i) => sum + (i.cantidad * i.precio_estimado), 0);

        if (ordenForm.id) {
            await updateOrden(ordenForm.id, {
                ...ordenForm,
                items: itemsToSave,
                insumo: summaryLabel,
                cantidad: totalQty,
                total_bruto: totalBruto,
                precio_estimado: itemsToSave[0].precio_estimado // Default backcomp
            });
        } else {
            let basePedido = (ordenForm.numeroPedido || "GEN").toString();
            basePedido = basePedido.replace(/\s+/g, '-').toUpperCase();

            // Get max seq for this basePedido
            const existingForPedido = ordenes.filter(o => o.id?.startsWith(basePedido));
            let maxSeq = 0;
            existingForPedido.forEach(o => {
                const parts = o.id.split('-');
                const num = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(num) && num > maxSeq) maxSeq = num;
            });

            const newIdRow = `${basePedido}-${(maxSeq + 1).toString().padStart(3, '0')}`;

            await createOrden({
                ...ordenForm,
                id: newIdRow,
                items: itemsToSave,
                insumo: summaryLabel,
                cantidad: totalQty,
                total_bruto: totalBruto,
                precio_estimado: itemsToSave[0].precio_estimado,
                estado: "Pendiente"
            });
        }
        // Reset forms
        setOrdenForm({ terceroId: "", insumoId: "", insumo: "", cantidad: 0, unidad: "Unidad", estado: "Pendiente", tiempoEntrega: "" });
        setOrderItems([{ insumoId: "", cantidad: 0, unidad: "Unidad", precio_estimado: 0 }]);
        setIsOrdenDialogOpen(false);
    };

    const editOrden = (o: OrdenCompra) => {
        setOrdenForm({ ...o });
        if (o.items && o.items.length > 0) {
            setOrderItems([...o.items]);
        } else {
            setOrderItems([{
                insumoId: o.insumoId || "",
                cantidad: o.cantidad,
                unidad: o.unidad,
                precio_estimado: o.precio_estimado || 0
            }]);
        }
        setIsOrdenDialogOpen(true);
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

        // Split title if too long
        doc.setFontSize(18);
        const title = "AUTORIZACION DE COMPRA ORIGEN BOTANICO";
        const splitTitle = doc.splitTextToSize(title, 120);
        doc.text(splitTitle, 14, 20);

        doc.setFontSize(9);
        doc.text(`Fecha: ${format(new Date(orden.created_at || new Date()), "dd/MM/yyyy")}`, 150, 15);
        doc.text(`No. Pedido: ${orden.numeroPedido || 'N/A'}`, 150, 21);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`ID UNICO: ${orden.id.toUpperCase()}`, 150, 27);
        doc.setFont("helvetica", "normal");

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

        const tableBody = (orden.items && orden.items.length > 0)
            ? orden.items.map((it, idx) => [
                (idx + 1).toString(),
                it.insumo,
                insumos.find(i => i.id === it.insumoId)?.sku || "N/A",
                it.cantidad.toLocaleString(),
                it.unidad,
                `$${(it.precio_estimado || 0).toLocaleString()}`,
                `$${((it.cantidad || 0) * (it.precio_estimado || 0)).toLocaleString()}`
            ])
            : [[
                "1",
                orden.insumo.replace(/ \+\d+ más$/, ""),
                insumos.find(i => i.id === orden.insumoId)?.sku || "N/A",
                orden.cantidad.toLocaleString(),
                orden.unidad,
                `$${(orden.precio_estimado || 0).toLocaleString()}`,
                `$${(orden.cantidad * (orden.precio_estimado || 0)).toLocaleString()}`
            ]];

        const totalEstimado = (orden.items && orden.items.length > 0)
            ? orden.items.reduce((sum, it) => sum + (it.cantidad * (it.precio_estimado || 0)), 0)
            : (orden.cantidad * (orden.precio_estimado || 0));

        autoTable(doc, {
            startY: 105,
            head: [["Item", "Descripción / Producto", "SKU Ref", "Cantidad", "Unidad", "Vr. Unitario", "Vr. Total"]],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [24, 60, 48], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 10 },
                3: { halign: 'center' },
                4: { halign: 'center' },
                5: { halign: 'right' },
                6: { halign: 'right', fontStyle: 'bold' }
            },
            foot: [[
                { content: 'TOTAL BRUTO A PAGAR COP', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: `$${totalEstimado.toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [24, 60, 48] } }
            ]]
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
        doc.text(`Valor Estimado Total: $${totalEstimado.toLocaleString()}`, 130, finalY);

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
        // Apply search filter
        const matchesSearch = o.insumo.toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            o.estado.toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            (t?.nombre || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            (o.id || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            (o.numeroPedido || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            (o.notas || "").toLowerCase().includes(searchOrdenes.toLowerCase()) ||
            (o.fechaSolicitada || "").toLowerCase().includes(searchOrdenes.toLowerCase());

        // Field Filters
        const matchesProvider = filterProviderId ? (t?.id === filterProviderId) : true;
        const matchesInsumo = filterInsumoId ? (o.items?.some(it => it.insumoId === filterInsumoId) || o.insumoId === filterInsumoId) : true;
        const matchesPedidoNum = filterPedidoNum ? (o.numeroPedido === filterPedidoNum || o.id.includes(filterPedidoNum)) : true;

        return matchesSearch && matchesProvider && matchesInsumo && matchesPedidoNum;
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
                                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md" onClick={() => {
                                            setOrdenForm({ terceroId: "", insumoId: "", insumo: "", cantidad: 0, unidad: "Unidad", estado: "Pendiente", tiempoEntrega: "", fechaSolicitada: format(new Date(), 'yyyy-MM-dd'), numeroPedido: "", notas: "", entregasParciales: "" });
                                            setOrderItems([{ insumoId: "", cantidad: 0, unidad: "Unidad", precio_estimado: 0 }]);
                                        }}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Nueva Orden
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>{ordenForm.id ? `EDITAR ORDEN ${ordenForm.id}` : 'NUEVA ORDEN DE COMPRA ORIGEN BOTÁNICO'} - {format(new Date(), 'dd/MM/yyyy')}</DialogTitle>
                                        </DialogHeader>
                                        <div className="text-sm text-gray-600 mb-2 p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                                            <div>
                                                <span className="font-bold">ZN E CENTRO LOGISTICO BG 16</span><br />
                                                Tel: (604) 2966310 | Rionegro - Colombia
                                            </div>
                                            <Building2 className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Proveedor Seleccionado</label>
                                                    <Select value={ordenForm.terceroId} onValueChange={v => setOrdenForm({ ...ordenForm, terceroId: v })} disabled={!!ordenForm.id}>
                                                        <SelectTrigger className="h-11 bg-white border-gray-200">
                                                            <SelectValue placeholder="Seleccione proveedor" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {terceros.map(t => (
                                                                <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="space-y-1 flex-1">
                                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">No. Pedido Interno</label>
                                                        <Input className="h-11" value={ordenForm.numeroPedido || ''} onChange={e => setOrdenForm({ ...ordenForm, numeroPedido: e.target.value })} placeholder="Ej. 55" />
                                                    </div>
                                                    <div className="space-y-1 flex-1">
                                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha Solicitada</label>
                                                        <Input className="h-11" type="date" value={ordenForm.fechaSolicitada || ''} onChange={e => setOrdenForm({ ...ordenForm, fechaSolicitada: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tiempo de Entrega / Parciales</label>
                                                    <div className="flex gap-2">
                                                        <Input className="h-11 flex-1" value={ordenForm.tiempoEntrega} onChange={e => setOrdenForm({ ...ordenForm, tiempoEntrega: e.target.value })} placeholder="Ej. 3 días hábiles" />
                                                        <Input className="h-11 flex-1" value={ordenForm.entregasParciales || ''} onChange={e => setOrdenForm({ ...ordenForm, entregasParciales: e.target.value })} placeholder="Fases de entrega" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Notas Adicionales</label>
                                                    <Input className="h-11" value={ordenForm.notas || ''} onChange={e => setOrdenForm({ ...ordenForm, notas: e.target.value })} placeholder="Ej. Entregar en portería principal" />
                                                </div>
                                            </div>

                                            <div className="space-y-3 p-4 border rounded-xl bg-gray-50/50">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="text-sm font-bold text-gray-800 uppercase tracking-wider">Insumos del Pedido</label>
                                                    {!ordenForm.id && (
                                                        <Button variant="outline" size="sm" className="h-8 bg-white" onClick={() => setOrderItems([...orderItems, { insumoId: "", cantidad: 0, unidad: "Unidad", precio_estimado: 0 }])}>
                                                            <Plus className="w-3 h-3 mr-1" /> Agregar
                                                        </Button>
                                                    )}
                                                </div>
                                                {orderItems.map((item, index) => (
                                                    <div key={index} className="space-y-3 p-4 bg-white border border-gray-100 rounded-lg relative">
                                                        {orderItems.length > 1 && (
                                                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}>
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                        <div className="space-y-1 pr-6">
                                                            <label className="text-xs font-semibold text-gray-600">Insumo / Producto a pedir</label>
                                                            <Select value={item.insumoId} onValueChange={v => {
                                                                const selectedInsumo = insumos.find(i => i.id === v);
                                                                const provSelect = terceros.find(t => t.id === ordenForm.terceroId);
                                                                const precioProv = provSelect?.insumosPrecios?.find(ip => ip.insumoId === v)?.precio || selectedInsumo?.precio || 0;
                                                                const newItems = [...orderItems];
                                                                newItems[index] = { ...newItems[index], insumoId: v, unidad: selectedInsumo?.unidad || "Unidad", precio_estimado: precioProv };
                                                                setOrderItems(newItems);
                                                            }} disabled={!ordenForm.terceroId}>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder={!ordenForm.terceroId ? "Seleccione proveedor primero" : "Seleccione Insumo"} />
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
                                                        <div className="grid grid-cols-12 gap-3">
                                                            <div className="col-span-4 space-y-1">
                                                                <label className="text-xs font-semibold text-gray-600">Val. Unitario ($)</label>
                                                                <Input className="h-10" type="number" value={item.precio_estimado || ''} onChange={e => {
                                                                    const newItems = [...orderItems];
                                                                    newItems[index].precio_estimado = Number(e.target.value);
                                                                    setOrderItems(newItems);
                                                                }} />
                                                            </div>
                                                            <div className="col-span-4 space-y-1">
                                                                <label className="text-xs font-semibold text-gray-600">Cantidad</label>
                                                                <Input className="h-10" type="number" value={item.cantidad || ''} onChange={e => {
                                                                    const newItems = [...orderItems];
                                                                    newItems[index].cantidad = Number(e.target.value);
                                                                    setOrderItems(newItems);
                                                                }} />
                                                            </div>
                                                            <div className="col-span-4 space-y-1">
                                                                <label className="text-xs font-semibold text-gray-600">Und.</label>
                                                                <Select value={item.unidad} onValueChange={v => {
                                                                    const newItems = [...orderItems];
                                                                    newItems[index].unidad = v;
                                                                    setOrderItems(newItems);
                                                                }}>
                                                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
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
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 border-t pt-4">
                                            <Button onClick={handleSaveOrden} className="w-full bg-[#183C30] hover:bg-[#122e24] h-12 text-lg font-bold">
                                                {ordenForm.id ? "Actualizar Orden" : "Generar Orden de Compra"}
                                            </Button>
                                            <p className="text-[11px] text-center text-gray-500">
                                                Al {ordenForm.id ? 'actualizar' : 'generar'} esta orden, se notificará al sistema de inventarios y proveedores correspondientes.
                                            </p>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        {/* Fila de Filtros Avanzados */}
                        <div className="flex flex-wrap gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-2">
                            <div className="flex-1 min-w-[200px] flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <Select value={filterProviderId} onValueChange={setFilterProviderId}>
                                    <SelectTrigger className="bg-slate-50 border-gray-100">
                                        <SelectValue placeholder="Filtrar por Proveedor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Todos los proveedores</SelectItem>
                                        {terceros.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 min-w-[200px] flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-400" />
                                <Select value={filterInsumoId} onValueChange={setFilterInsumoId}>
                                    <SelectTrigger className="bg-slate-50 border-gray-100">
                                        <SelectValue placeholder="Filtrar por Insumo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Todos los insumos</SelectItem>
                                        {insumos.map(i => <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-40 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-400" />
                                <Input
                                    className="bg-slate-50 border-gray-100"
                                    placeholder="No. Pedido / ID"
                                    value={filterPedidoNum}
                                    onChange={e => setFilterPedidoNum(e.target.value)}
                                />
                            </div>
                            {(filterProviderId || filterInsumoId || filterPedidoNum) && (
                                <Button variant="ghost" onClick={() => { setFilterProviderId(""); setFilterInsumoId(""); setFilterPedidoNum(""); }} className="text-gray-400 hover:text-red-500">
                                    <X className="w-4 h-4 mr-2" /> Limpiar
                                </Button>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] p-4 bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                                <div>Ítems / Detalle</div>
                                <div>Proveedor</div>
                                <div className="text-center">Cant. Total</div>
                                <div className="text-center">Total Bruto</div>
                                <div className="text-center">Estado</div>
                                <div className="w-[180px] text-center">Acciones</div>
                            </div>
                            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                                {filteredOrdenes.map(o => {
                                    const tercero = terceros.find(t => t.id === o.terceroId);
                                    const isRecibido = o.estado === "Recibido";
                                    return (
                                        <div key={o.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] p-4 items-center hover:bg-slate-50 transition-colors border-b last:border-0">
                                            <div>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-[#183C30] text-[15px] flex items-center gap-2">
                                                        <ShoppingCart className="w-4 h-4" />
                                                        Orden {o.numeroPedido || o.id}
                                                    </p>
                                                    <p className="text-[12px] text-gray-600 leading-relaxed max-w-md">
                                                        Esta es la OC <span className="font-bold text-gray-800">{o.id}</span> del proveedor <span className="font-bold text-gray-800">{tercero?.nombre}</span> por un total de <span className="font-bold text-teal-700">${(o.total_bruto || (o.cantidad * (o.precio_estimado || 0))).toLocaleString()}</span>.
                                                        <span className="block text-gray-400 mt-0.5 italic">Si desea ver el detalle de los productos, presione el botón de visualizar.</span>
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2 items-center mt-3">
                                                    <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-mono border border-gray-200">
                                                        REF: {o.id}
                                                    </span>
                                                    {o.numeroPedido && <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 uppercase">Pedido: {o.numeroPedido}</span>}
                                                    {o.created_at && <p className="text-[10px] text-gray-400">📅 {format(new Date(o.created_at), 'dd/MM/yyyy')}</p>}
                                                </div>
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-medium text-gray-700 truncate">{tercero?.nombre || "Desconocido"}</p>
                                                <p className="text-[10px] text-gray-500">NIT/CC: {tercero?.nit}</p>
                                            </div>
                                            <div className="text-center font-bold text-gray-700 text-sm">
                                                {o.items ? o.items.reduce((sum, i) => sum + i.cantidad, 0) : o.cantidad}
                                            </div>
                                            <div className="text-center font-bold text-teal-700 text-sm">
                                                ${(o.total_bruto || ((o.precio_estimado || 0) * o.cantidad)).toLocaleString()}
                                            </div>
                                            <div className="flex justify-center">
                                                <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 w-max ${isRecibido ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {isRecibido ? <CheckCircle className="w-3 h-3" /> : <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                                    {o.estado}
                                                </span>
                                            </div>
                                            <div className="w-[180px] flex justify-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => { setViewingOrden(o); setIsViewDialogOpen(true); }} className="text-teal-600 hover:bg-teal-50 h-8 w-8" title="Visualizar Orden">
                                                    <FileText className="w-4 h-4" />
                                                </Button>
                                                {!isRecibido ? (
                                                    <>
                                                        <Button variant="ghost" size="icon" onClick={() => editOrden(o)} className="text-blue-500 hover:bg-blue-50 h-8 w-8" title="Editar Orden">
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <div className="relative">
                                                            <Input
                                                                type="file"
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                onChange={(e) => handleReceiveOrder(o.id, e)}
                                                                disabled={uploadingFile}
                                                                accept="image/*,.pdf"
                                                            />
                                                            <Button variant="ghost" size="icon" className="text-emerald-500 hover:bg-emerald-50 h-8 w-8" disabled={uploadingFile}>
                                                                <UploadCloud className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <Button variant="ghost" size="icon" onClick={() => o.comprobanteUrl && window.open(o.comprobanteUrl)} className="text-teal-500 hover:bg-teal-50 h-8 w-8" title="Ver Comprobante">
                                                        <FileText className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" onClick={() => exportarOrdenPDF(o, tercero || {} as Tercero)} className="text-amber-600 hover:bg-amber-50 h-8 w-8" title="Descargar PDF">
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteOrden(o.id)} className="text-red-500 hover:bg-red-50 h-8 w-8" title="Eliminar Orden">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
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
                    </div>
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
                )
                }

                {/* --- DIALOGO DE VISTA PREVIA (SIN DESCARGAR) --- */}
                <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-teal-600" />
                                Vista Previa de Autorización de Compra
                            </DialogTitle>
                        </DialogHeader>
                        {viewingOrden && (
                            <div className="space-y-6 py-4">
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">ID Único</p>
                                        <p className="font-mono text-sm font-bold text-slate-700">{viewingOrden.id}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Fecha</p>
                                        <p className="text-sm font-bold">{format(new Date(viewingOrden.created_at || new Date()), 'dd/MM/yyyy')}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">No. Pedido Interno</p>
                                        <p className="text-sm font-bold">{viewingOrden.numeroPedido || 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Estado</p>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${viewingOrden.estado === 'Recibido' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {viewingOrden.estado}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-3 border-b pb-2">
                                        <Building2 className="w-4 h-4 text-slate-400" /> Datos del Proveedor
                                    </h4>
                                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                                        <p className="text-slate-500">Razon Social:</p>
                                        <p className="font-semibold">{terceros.find(t => t.id === viewingOrden.terceroId)?.nombre || 'Desconocido'}</p>
                                        <p className="text-slate-500">Documento/NIT:</p>
                                        <p className="font-semibold">{terceros.find(t => t.id === viewingOrden.terceroId)?.nit || 'N/A'}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-3 border-b pb-2">
                                        <Package className="w-4 h-4 text-slate-400" /> Detalle de Productos
                                    </h4>
                                    <div className="border rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-sm">
                                            <thead className="bg-[#183C30] text-white">
                                                <tr>
                                                    <th className="px-4 py-2 text-center w-12">Item</th>
                                                    <th className="px-4 py-2 text-left">Insumo / Descripción</th>
                                                    <th className="px-4 py-2 text-center">Cantidad</th>
                                                    <th className="px-4 py-2 text-right">Precio Un.</th>
                                                    <th className="px-4 py-2 text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {(viewingOrden.items && viewingOrden.items.length > 0) ? (
                                                    viewingOrden.items.map((it, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-2 text-slate-500 text-xs text-center">{idx + 1}</td>
                                                            <td className="px-4 py-2 font-medium text-slate-700">{it.insumo}</td>
                                                            <td className="px-4 py-2 text-center">{it.cantidad.toLocaleString()} {it.unidad}</td>
                                                            <td className="px-4 py-2 text-right font-semibold text-slate-500">${(it.precio_estimado || 0).toLocaleString()}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-teal-700">${((it.cantidad || 0) * (it.precio_estimado || 0)).toLocaleString()}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td className="px-4 py-2 text-slate-500 text-xs text-center">1</td>
                                                        <td className="px-4 py-2 font-medium text-slate-700">{viewingOrden.insumo.replace(/ \+\d+ más$/, "")}</td>
                                                        <td className="px-4 py-2 text-center">{viewingOrden.cantidad.toLocaleString()} {viewingOrden.unidad}</td>
                                                        <td className="px-4 py-2 text-right font-semibold text-slate-500">${(viewingOrden.precio_estimado || 0).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right font-bold text-teal-700">${((viewingOrden.cantidad || 0) * (viewingOrden.precio_estimado || 0)).toLocaleString()}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot className="bg-slate-50 font-bold border-t">
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-3 text-right text-slate-600 uppercase tracking-wider text-xs">Total Bruto Estimado</td>
                                                    <td className="px-4 py-3 text-right text-teal-800 text-lg">
                                                        ${(viewingOrden.total_bruto || (viewingOrden.cantidad * (viewingOrden.precio_estimado || 0))).toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>

                                {viewingOrden.notas && (
                                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 italic text-sm text-amber-900 shadow-inner">
                                        <p className="font-bold mb-1 non-italic uppercase text-[10px] tracking-widest text-amber-700">Notas:</p>
                                        {viewingOrden.notas}
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Cerrar</Button>
                                    <Button variant="default" onClick={() => {
                                        const t = terceros.find(terc => terc.id === viewingOrden.terceroId);
                                        if (t) exportarOrdenPDF(viewingOrden, t);
                                    }} className="bg-[#183C30] hover:bg-[#122e24]">
                                        <Download className="w-4 h-4 mr-2" /> Descargar PDF
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

            </div >
        </div >
    );
}
