"use client";

import { useState } from "react";
import { useCompras, OrdenCompra } from "@/hooks/useCompras";
import { ShoppingCart, Building2, FileText } from "lucide-react";
import { TercerosSection } from "./components/TercerosSection";
import { InsumosSection } from "./components/InsumosSection";
import { ProductosSection } from "./components/ProductosSection";
import { OrdenesSection } from "./components/OrdenesSection";
import { VisualizeOrdenDialog } from "./components/VisualizeOrdenDialog";

export default function ComprasPage() {
    const {
        terceros, ordenes, insumos, productos, isLoading,
        createTercero, updateTercero, deleteTercero,
        createOrden, updateOrden, deleteOrden,
        createInsumo, deleteInsumo,
        createProducto, updateProducto, deleteProducto
    } = useCompras();

    const [activeTab, setActiveTab] = useState<"terceros" | "ordenes" | "insumos" | "productos">("ordenes");

    const [viewingOrden, setViewingOrden] = useState<OrdenCompra | null>(null);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-50/50">
                <div className="w-8 h-8 border-4 border-[#183C30]/20 border-t-[#183C30] rounded-full animate-spin"></div>
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
                        setViewingOrden={setViewingOrden}
                        setIsViewDialogOpen={setIsViewDialogOpen}
                    />
                )}

                {activeTab === "insumos" && (
                    <InsumosSection
                        insumos={insumos}
                        createInsumo={createInsumo}
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

                <VisualizeOrdenDialog
                    open={isViewDialogOpen}
                    onOpenChange={setIsViewDialogOpen}
                    viewingOrden={viewingOrden}
                    terceros={terceros}
                    insumos={insumos}
                />
            </div>
        </div>
    );
}
