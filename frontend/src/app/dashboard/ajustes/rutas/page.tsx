"use client";

import { useState, useEffect } from "react";
import { Link2, Save, Loader2, Database, AlertCircle, FileSpreadsheet } from "lucide-react";
import { API_URL } from "@/lib/config";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function RutasSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [urls, setUrls] = useState({
        inventory_sheet_url: "",
        conciliacion_sheet_url: ""
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem("gco_token");
            const res = await fetch(`${API_URL}/config/settings`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Error fetching settings");

            const data = await res.json();
            setUrls({
                inventory_sheet_url: data.inventory_sheet_url || "",
                conciliacion_sheet_url: data.conciliacion_sheet_url || ""
            });
        } catch (error) {
            console.error(error);
            toast.error("Error cargando rutas predeterminadas");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem("gco_token");
            const res = await fetch(`${API_URL}/config/settings`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(urls)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Error guardando rutas");
            }

            toast.success("Rutas actualizadas exitosamente");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-gray-100">
                <div className="flex items-center space-x-3 mb-8 pb-6 border-b border-gray-100">
                    <div className="p-3 bg-emerald-100/50 rounded-2xl">
                        <Database className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-[#183C30] tracking-tight">Orígenes de Datos</h1>
                        <p className="text-sm font-medium text-gray-500 mt-1">
                            Configura los enlaces (Google Sheets) base de los cuales el sistema consume la información global.
                        </p>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Inventory URL */}
                    <div className="space-y-3">
                        <label className="flex items-center space-x-2 text-sm font-bold text-gray-700 uppercase tracking-widest pl-1">
                            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                            <span>Cantidades Libre / Base de MRP</span>
                        </label>
                        <p className="text-xs text-gray-400 font-medium pl-1 mb-2">Este enlace se usa en la Distribución Inteligente, Saldos, Inventario, y cálculo de MRP para conocer el stock real disponible.</p>

                        <div className="relative group">
                            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="text"
                                className="w-full pl-12 pr-4 py-4 bg-gray-50/80 border-2 border-transparent focus:border-emerald-500/20 focus:bg-white rounded-2xl outline-none transition-all font-medium text-gray-600 text-sm focus:ring-4 focus:ring-emerald-500/10 placeholder:text-gray-300 shadow-inner"
                                placeholder="https://docs.google.com/spreadsheets/example..."
                                value={urls.inventory_sheet_url}
                                onChange={(e) => setUrls({ ...urls, inventory_sheet_url: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Conciliador URL */}
                    <div className="space-y-3">
                        <label className="flex items-center space-x-2 text-sm font-bold text-gray-700 uppercase tracking-widest pl-1">
                            <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                            <span>Hoja del Conciliador de Ventas</span>
                        </label>
                        <p className="text-xs text-gray-400 font-medium pl-1 mb-2">Este enlace se carga por defecto al abrir la herramienta de Conciliación de Facturas vs Google Sheets.</p>

                        <div className="relative group">
                            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                className="w-full pl-12 pr-4 py-4 bg-gray-50/80 border-2 border-transparent focus:border-blue-500/20 focus:bg-white rounded-2xl outline-none transition-all font-medium text-gray-600 text-sm focus:ring-4 focus:ring-blue-500/10 placeholder:text-gray-300 shadow-inner"
                                placeholder="https://docs.google.com/spreadsheets/example..."
                                value={urls.conciliacion_sheet_url}
                                onChange={(e) => setUrls({ ...urls, conciliacion_sheet_url: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Alert info */}
                    <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex items-start space-x-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-amber-800">Nota de compatibilidad</p>
                            <p className="text-xs font-medium text-amber-700/80 leading-relaxed">
                                Recuerda que los links que proporciones deben estar <strong>Publicados en la web</strong> (Archivo &gt; Compartir &gt; Publicar en la Web) o tener permisos para que cualquiera con el enlace pueda leerlos (Formato export).
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex justify-end">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all flex items-center space-x-2 text-sm uppercase tracking-widest disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            <span>{saving ? 'Guardando...' : 'Guardar Rutas'}</span>
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
}
