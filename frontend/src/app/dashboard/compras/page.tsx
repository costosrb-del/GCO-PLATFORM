"use client";

import { useState } from "react";
import { useCompras, OrdenCompra } from "@/hooks/useCompras";
import { ShoppingCart, Building2, FileText, Wand2, Truck } from "lucide-react";
import { TercerosSection } from "./components/TercerosSection";
import { InsumosSection } from "./components/InsumosSection";
import { ProductosSection } from "./components/ProductosSection";
import { OrdenesSection } from "./components/OrdenesSection";
import { VisualizeOrdenDialog } from "./components/VisualizeOrdenDialog";
import { GeneradorPedidoSection } from "./components/GeneradorPedidoSection";
import { EntregasSection } from "./components/EntregasSection";
import { ControlMaquilaSection } from "./components/ControlMaquilaSection";
import { Beaker } from "lucide-react";
import { ImportadorMasivo } from "./components/ImportadorMasivo";

export default function ComprasPage() {
    const {
        terceros, ordenes, insumos, productos, isLoading,
        createTercero, updateTercero, deleteTercero,
        createOrden, updateOrden, deleteOrden,
        createInsumo, updateInsumo, deleteInsumo,
        createProducto, updateProducto, deleteProducto
    } = useCompras();

    const [activeTab, setActiveTab] = useState<"terceros" | "ordenes" | "insumos" | "productos" | "generador" | "entregas" | "maquila">("ordenes");

    const [viewingOrdenId, setViewingOrdenId] = useState<string | null>(null);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    // Derivar viewingOrden en vivo desde el caché de React Query para que las entregas parciales
    // acumulen correctamente sin cerrar/reabrir el diálogo
    const viewingOrden = viewingOrdenId ? (ordenes.find(o => o.id === viewingOrdenId) ?? null) : null;

    // Skeleton Loading Placeholder
    if (isLoading && !ordenes.length) {
        return (
            <div className="min-h-screen bg-slate-50/50 p-6 space-y-6 animate-pulse">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="h-24 bg-white rounded-2xl border border-gray-100" />
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100" />)}
                    </div>
                    <div className="h-[500px] bg-white rounded-2xl border border-gray-100" />
                </div>
            </div>
        );
    }

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
                        <p className="text-sm text-gray-500 mt-1 font-medium flex items-center gap-2">
                            Control de terceros, proveedores y órdenes de compra de insumos.
                            {isLoading && (
                                <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    ACTUALIZANDO
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center self-start md:self-auto">
                        <ImportadorMasivo
                            createInsumo={createInsumo}
                            createTercero={createTercero}
                            createProducto={createProducto}
                            updateProducto={updateProducto}
                            insumosExistentes={insumos}
                            productosExistentes={productos}
                            tercerosExistentes={terceros}
                        />
                        <div className="flex bg-gray-100/80 p-1.5 rounded-xl">
                            <button
                                onClick={() => setActiveTab("ordenes")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === "ordenes" ? "bg-white text-[#183C30] shadow-sm transform scale-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                            >
                                Órdenes
                            </button>
                            <button
                                onClick={() => setActiveTab("terceros")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === "terceros" ? "bg-white text-[#183C30] shadow-sm transform scale-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                            >
                                Proveedores
                            </button>
                            <button
                                onClick={() => setActiveTab("insumos")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === "insumos" ? "bg-white text-[#183C30] shadow-sm transform scale-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                            >
                                Insumos
                            </button>
                            <button
                                onClick={() => setActiveTab("productos")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === "productos" ? "bg-white text-[#183C30] shadow-sm transform scale-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
                            >
                                Productos
                            </button>
                            <button
                                onClick={() => setActiveTab("generador")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${activeTab === "generador"
                                    ? "bg-violet-600 text-white shadow-sm"
                                    : "text-gray-500 hover:text-violet-600 hover:bg-violet-50"
                                    }`}
                            >
                                <Wand2 className="w-3 h-3" />
                                MRP
                            </button>
                            <button
                                onClick={() => setActiveTab("entregas")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${activeTab === "entregas"
                                    ? "bg-[#183C30] text-white shadow-sm"
                                    : "text-gray-500 hover:text-[#183C30] hover:bg-emerald-50"
                                    }`}
                            >
                                <Truck className="w-3 h-3" />
                                Entregas
                            </button>
                            <button
                                onClick={() => setActiveTab("maquila")}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${activeTab === "maquila"
                                    ? "bg-amber-500 text-white shadow-sm transform scale-100"
                                    : "text-gray-500 hover:text-amber-600 hover:bg-amber-50"
                                    }`}
                            >
                                <Beaker className="w-3 h-3" />
                                Laboratorio
                            </button>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-emerald-100 p-3 rounded-xl"><ShoppingCart className="w-6 h-6 text-emerald-600" /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Órdenes</p>
                            <p className="text-xl font-black text-gray-900">{ordenes.length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-amber-100 p-3 rounded-xl"><div className="w-6 h-6 rounded-full bg-amber-500 animate-pulse" /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pendientes</p>
                            <p className="text-xl font-black text-gray-900">{ordenes.filter(o => o.estado === "Pendiente").length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-xl"><Building2 className="w-6 h-6 text-blue-600" /></div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Proveedores</p>
                            <p className="text-xl font-black text-gray-900">{terceros.length}</p>
                        </div>
                    </div>
                    <div className="bg-[#183C30] p-5 rounded-2xl shadow-lg border border-emerald-900 flex items-center gap-4">
                        <div className="bg-white/10 p-3 rounded-xl border border-white/10"><FileText className="w-6 h-6 text-emerald-400" /></div>
                        <div>
                            <p className="text-xs font-bold text-emerald-100/60 uppercase tracking-wider">Inversión Total</p>
                            <p className="text-xl font-black text-white">
                                ${ordenes.reduce((sum, o) => sum + (o.total_bruto || (o.cantidad * (o.precio_estimado || 0))), 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                {activeTab === "terceros" && (
                    <TercerosSection
                        terceros={terceros}
                        insumos={insumos}
                        ordenes={ordenes}
                        createTercero={createTercero}
                        updateTercero={updateTercero}
                        deleteTercero={deleteTercero}
                    />
                )}

                {activeTab === "ordenes" && (
                    <OrdenesSection
                        ordenes={ordenes}
                        terceros={terceros}
                        insumos={insumos}
                        createOrden={createOrden}
                        updateOrden={updateOrden}
                        deleteOrden={deleteOrden}
                        setViewingOrden={(orden) => setViewingOrdenId(orden?.id ?? null)}
                        setIsViewDialogOpen={setIsViewDialogOpen}
                    />
                )}

                {activeTab === "insumos" && (
                    <InsumosSection
                        insumos={insumos}
                        createInsumo={createInsumo}
                        updateInsumo={updateInsumo}
                        deleteInsumo={deleteInsumo}
                    />
                )}

                {activeTab === "productos" && (
                    <ProductosSection
                        productos={productos}
                        insumos={insumos}
                        createProducto={createProducto}
                        updateProducto={updateProducto}
                        deleteProducto={deleteProducto}
                    />
                )}

                {activeTab === "generador" && (
                    <GeneradorPedidoSection
                        productos={productos}
                        insumos={insumos}
                        terceros={terceros}
                        ordenes={ordenes}
                        createOrden={createOrden}
                        updateOrden={updateOrden}
                    />
                )}

                {activeTab === "entregas" && (
                    <EntregasSection
                        terceros={terceros}
                        insumos={insumos}
                        ordenes={ordenes}
                    />
                )}

                {activeTab === "maquila" && (
                    <ControlMaquilaSection
                        productos={productos}
                    />
                )}

                <VisualizeOrdenDialog
                    open={isViewDialogOpen}
                    onOpenChange={setIsViewDialogOpen}
                    viewingOrden={viewingOrden}
                    terceros={terceros}
                    insumos={insumos}
                    updateOrden={updateOrden}
                />
            </div>
        </div>
    );
}
