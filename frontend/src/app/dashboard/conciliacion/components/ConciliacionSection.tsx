"use client";

import { useState } from "react";
import { Search, Loader2, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, Download, Filter, RefreshCcw, TrendingUp, ChevronUp, ChevronDown, Mail, Settings, FileText, ChevronRight, Share2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_URL } from "@/lib/config";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";

interface ConciliacionResult {
    matched: any[];
    diferencias: any[];
    solo_siigo: any[];
    solo_sheets: any[];
}

const SummaryCard = ({ title, value, color, icon: Icon }: any) => (
    <div
        className={`bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-3 transition-all duration-300 hover:shadow-md`}
    >
        <div className={`p-2.5 rounded-xl ${color} bg-opacity-10 text-opacity-90`}>
            <Icon className={`h-4 w-4 ${color.replace('bg-', 'text-')}`} />
        </div>
        <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</p>
            <p className="text-lg font-black text-gray-800 leading-tight">{value}</p>
        </div>
    </div>
);

export function ConciliacionSection() {
    const [url, setUrl] = useState("https://docs.google.com/spreadsheets/d/e/2PACX-1vQX-cGiE9Da8QvYsYBpCAiPwvm4QL2frVBckyh7O0wusUkKPJLoSGH9ygsnv_-3e92ZjV_noh-a8a97/pub?output=csv");
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ConciliacionResult | null>(null);
    const [activeTab, setActiveTab] = useState<"diferencias" | "solo_siigo" | "solo_sheets" | "matched">("diferencias");
    const [excludeAlmaverde, setExcludeAlmaverde] = useState(true);

    // UI States
    const [showConfig, setShowConfig] = useState(true);
    const [filterInvoice, setFilterInvoice] = useState("");
    const [filterProduct, setFilterProduct] = useState("");

    // Email states
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailRecipients, setEmailRecipients] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);

    // Settings state
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    const getFilteredList = (tabData: any[]) => {
        if (!tabData) return [];
        return tabData.filter(item => {
            const matchInvoice = !filterInvoice || String(item.invoice || "").toLowerCase().includes(filterInvoice.toLowerCase());
            let matchProduct = true;
            if (filterProduct) {
                const q = filterProduct.toLowerCase();
                const siigoKeys = Object.keys(item.siigo_items || item.items || {});
                const sheetKeys = Object.keys(item.sheet_items || {});
                const diffs = (item.diffs || []).map((d: string) => d.toLowerCase());

                matchProduct = siigoKeys.some(k => k.toLowerCase().includes(q)) ||
                    sheetKeys.some(k => k.toLowerCase().includes(q)) ||
                    diffs.some((d: string) => d.includes(q));
            }
            return matchInvoice && matchProduct;
        });
    };

    const handleExportPDF = () => {
        if (!data) return;
        const doc = new jsPDF();

        // Helper to calculate totals
        const calculateTotals = () => {
            const bySku: Record<string, number> = {};
            const byCompany: Record<string, number> = {};
            let totalUnits = 0;

            const processList = (list: any[]) => {
                list.forEach(item => {
                    const siigoItems = item.siigo_items || item.items || {};
                    const sheetItems = item.sheet_items || {};
                    const allSkus = new Set([...Object.keys(siigoItems), ...Object.keys(sheetItems)]);

                    allSkus.forEach(sku => {
                        const qty = (siigoItems[sku] || 0) > 0 ? siigoItems[sku] : (sheetItems[sku] || 0);
                        bySku[sku] = (bySku[sku] || 0) + qty;
                        byCompany[item.empresa] = (byCompany[item.empresa] || 0) + qty;
                        totalUnits += qty;
                    });
                });
            };

            processList(data.matched);
            processList(data.diferencias);
            processList(data.solo_siigo);
            processList(data.solo_sheets);

            return { bySku, byCompany, totalUnits };
        };

        const totals = calculateTotals();

        // Header Compacto
        doc.setFillColor(24, 60, 48);
        doc.rect(0, 0, 210, 20, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("INFORME GCO: CONCILIACIÓN Y VENTAS", 14, 12);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Periodo: ${startDate} al ${endDate} | Generado: ${new Date().toLocaleString()}`, 14, 17);

        let finalY = 25;

        // Resumen y SKU lado a lado
        autoTable(doc, {
            startY: finalY,
            head: [["RESUMEN EJECUTIVO", "VALOR"]],
            body: [
                ["Facturas Conciliadas OK", data.matched.length],
                ["Facturas con Diferencias", data.diferencias.length],
                ["Solo en Siigo", data.solo_siigo.length],
                ["Solo en Sheets", data.solo_sheets.length],
                ["TOTAL UNIDADES", totals.totalUnits.toLocaleString()]
            ],
            theme: "grid",
            headStyles: { fillColor: [24, 60, 48] },
            styles: { fontSize: 7, cellPadding: 1 },
            margin: { right: 110 }
        });

        autoTable(doc, {
            startY: finalY,
            head: [["SKU", "UNID"]],
            body: Object.entries(totals.bySku).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([sku, qty]) => [sku, qty.toLocaleString()]),
            theme: "striped",
            headStyles: { fillColor: [20, 83, 45] },
            styles: { fontSize: 7, cellPadding: 1 },
            margin: { left: 110 }
        });

        finalY = (doc as any).lastAutoTable.finalY + 8;

        // Listado Detallado Muy Compacto
        doc.setFontSize(9);
        doc.setTextColor(24, 60, 48);
        doc.text("LISTADO DETALLADO DE FACTURAS", 14, finalY);

        const allDocs = [
            ...data.matched.map((i: any) => ({ ...i, estado: "OK" })),
            ...data.diferencias.map((i: any) => ({ ...i, estado: "DIF" })),
            ...data.solo_siigo.map((i: any) => ({ ...i, estado: "S. SIIGO" })),
            ...data.solo_sheets.map((i: any) => ({ ...i, estado: "S. SHEETS" }))
        ];

        autoTable(doc, {
            startY: finalY + 4,
            head: [["Empresa", "Factura", "Fecha", "Cliente", "Est."]],
            body: allDocs.map(d => [
                d.empresa.substring(0, 15),
                d.invoice,
                d.date,
                d.client.substring(0, 25),
                d.estado
            ]),
            styles: { fontSize: 5.5, cellPadding: 0.5 },
            headStyles: { fillColor: [24, 60, 48] },
            margin: { bottom: 10 }
        });

        doc.save(`Conciliacion_Compacta_GCO_${startDate}_a_${endDate}.pdf`);
        toast.success("PDF Compacto generado exitosamente");
    };

    const handleExport = () => {
        if (!data) return;

        try {
            const wb = XLSX.utils.book_new();

            const flattenItems = (items: any[], defaultStatus: string = "") => {
                const rows: any[] = [];
                items.forEach(doc => {
                    const siigoItems = doc.siigo_items || {};
                    const sheetItems = doc.sheet_items || {};
                    const allSkus = Array.from(new Set([...Object.keys(siigoItems), ...Object.keys(sheetItems)]));

                    if (allSkus.length === 0) {
                        rows.push({
                            Empresa: doc.empresa,
                            Factura: doc.invoice,
                            Fecha: doc.date,
                            Cliente: doc.client,
                            SKU_Siigo: "-",
                            Cant_Siigo: 0,
                            SKU_Sheet: "-",
                            Cant_Sheet: 0,
                            Saldo: 0,
                            Conciliación: defaultStatus || "Sin Items"
                        });
                    } else {
                        allSkus.forEach(sku => {
                            const sq = siigoItems[sku] || 0;
                            const gq = sheetItems[sku] || 0;
                            rows.push({
                                Empresa: doc.empresa,
                                Factura: doc.invoice,
                                Fecha: doc.date,
                                Cliente: doc.client,
                                SKU_Siigo: siigoItems[sku] !== undefined ? sku : "-",
                                Cant_Siigo: sq,
                                SKU_Sheet: sheetItems[sku] !== undefined ? sku : "-",
                                Cant_Sheet: gq,
                                Saldo: sq - gq,
                                Conciliación: defaultStatus || (sq === gq ? "CONCILIADO CORRECTAMENTE" : (sq > gq ? "SOBRA EN SIIGO" : "FALTA EN SIIGO"))
                            });
                        });
                    }
                });
                return rows;
            };

            // 1. Matched (Facturas Conciliadas Correctamente)
            const matchedRows = flattenItems(data.matched, "CONCILIADO CORRECTAMENTE");
            const wsMatched = XLSX.utils.json_to_sheet(matchedRows);
            XLSX.utils.book_append_sheet(wb, wsMatched, "FACTURAS OK");

            // 2. Diferencias
            const diffRows = flattenItems(data.diferencias);
            const wsDiff = XLSX.utils.json_to_sheet(diffRows);
            XLSX.utils.book_append_sheet(wb, wsDiff, "DIFERENCIAS");

            // 3. Solo Siigo
            const soloSiigoRows = flattenItems(data.solo_siigo, "PENDIENTE EN EXCEL");
            const wsSoloSiigo = XLSX.utils.json_to_sheet(soloSiigoRows);
            XLSX.utils.book_append_sheet(wb, wsSoloSiigo, "SOLO SIIGO");

            // 4. Solo Sheets
            const soloSheetsRows = flattenItems(data.solo_sheets, "PENDIENTE EN SIIGO");
            const wsSoloSheets = XLSX.utils.json_to_sheet(soloSheetsRows);
            XLSX.utils.book_append_sheet(wb, wsSoloSheets, "SOLO EXCEL");

            // 5. Consolidado (NUEVO)
            const allRows = [...matchedRows, ...diffRows, ...soloSiigoRows, ...soloSheetsRows];

            // By SKU and Company
            const bySku: Record<string, number> = {};
            const byCompany: Record<string, number> = {};

            allRows.forEach(row => {
                const sku = row.SKU_Siigo !== "-" ? row.SKU_Siigo : row.SKU_Sheet;
                const company = row.Empresa;
                // Sum units from Siigo if available, otherwise from Sheets
                const qty = row.Cant_Siigo > 0 ? row.Cant_Siigo : (row.Cant_Sheet || 0);

                if (sku && sku !== "-") bySku[sku] = (bySku[sku] || 0) + qty;
                if (company) byCompany[company] = (byCompany[company] || 0) + qty;
            });

            const consolidadoData = [
                ["INFORME CONSOLIDADO DE RECUENTO", ""],
                ["Fecha de Generación:", new Date().toLocaleDateString()],
                ["Periodo:", `${startDate} a ${endDate}`],
                [""],
                ["CONSOLIDADO POR REFERENCIA (SKU)", ""],
                ["Referencia / SKU", "Total Unidades Procesadas"],
                ...Object.entries(bySku).sort((a, b) => b[1] - a[1]),
                [""],
                ["CONSOLIDADO POR EMPRESA", ""],
                ["Empresa", "Total Unid. Gestionadas"],
                ...Object.entries(byCompany).sort((a, b) => b[1] - a[1])
            ];

            const wsConsolidado = XLSX.utils.aoa_to_sheet(consolidadoData);
            // Auto-size columns for better readability
            wsConsolidado['!cols'] = [{ wch: 30 }, { wch: 25 }];
            XLSX.utils.book_append_sheet(wb, wsConsolidado, "CONSOLIDADO TOTAL");

            XLSX.writeFile(wb, `Conciliacion_GCO_${startDate}_a_${endDate}.xlsx`);
            toast.success("Excel con consolidado y comparativa descargado");
        } catch (error) {
            console.error(error);
            toast.error("Error al exportar Excel");
        }
    };

    const handleConciliar = async () => {
        if (!url) {
            toast.error("Por favor ingrese la URL de Google Sheets");
            return;
        }

        setLoading(true);
        setData(null);
        try {
            const token = localStorage.getItem("gco_token");
            const res = await fetch(`${API_URL}/conciliacion/?url=${encodeURIComponent(url)}&start_date=${startDate}&end_date=${endDate}&exclude_almaverde=${excludeAlmaverde}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Error en la conciliación");
            }

            const result = await res.json();
            setData(result);

            if (result.diferencias.length > 0) setActiveTab("diferencias");
            else if (result.solo_siigo.length > 0) setActiveTab("solo_siigo");
            else if (result.solo_sheets.length > 0) setActiveTab("solo_sheets");
            else setActiveTab("matched");

            toast.success("Conciliación completada");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        if (!data || !emailRecipients.trim()) {
            toast.error("Por favor ingresa al menos un correo.");
            return;
        }

        const emails = emailRecipients.split(",").map(e => e.trim()).filter(e => e);
        if (emails.length === 0) return;

        setSendingEmail(true);
        try {
            const token = localStorage.getItem("gco_token");
            const payload = {
                start_date: startDate,
                end_date: endDate,
                stats: {
                    matched: data.matched.length,
                    diferencias: data.diferencias.length,
                    solo_siigo: data.solo_siigo.length,
                    solo_sheets: data.solo_sheets.length,
                    total: data.matched.length + data.diferencias.length + data.solo_siigo.length + data.solo_sheets.length
                },
                discrepancies: data.diferencias,
                emails: emails
            };

            const res = await fetch(`${API_URL}/conciliacion/email`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Error enviando correo");
            }

            toast.success("Resumen enviado por correo exitosamente");
            setShowEmailModal(false);
            setEmailRecipients("");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSendingEmail(false);
        }
    };

    const getTabStyle = (tabCode: string) => {
        const isActive = activeTab === tabCode;
        const base = "px-4 py-2.5 text-xs font-bold transition-all flex items-center space-x-2 relative truncate";
        if (!isActive) return `${base} text-gray-400 hover:text-gray-600`;

        switch (tabCode) {
            case "diferencias": return `${base} text-amber-600`;
            case "solo_siigo": return `${base} text-rose-600`;
            case "solo_sheets": return `${base} text-orange-600`;
            case "matched": return `${base} text-emerald-600`;
            default: return base;
        }
    };


    return (
        <div className="space-y-4 max-w-full px-4 mx-auto pb-8">
            {/* Header Info - Stats summary */}
            <AnimatePresence>
                {data && (
                    <div className="flex flex-col space-y-3">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <SummaryCard title="Coinciden" value={data.matched.length} color="bg-emerald-500" icon={CheckCircle2} />
                            <SummaryCard title="Diferencias" value={data.diferencias.length} color="bg-amber-500" icon={AlertTriangle} />
                            <SummaryCard title="Pend. en Sheet" value={data.solo_siigo.length} color="bg-rose-500" icon={XCircle} />
                            <SummaryCard title="Pend. en Siigo" value={data.solo_sheets.length} color="bg-orange-500" icon={RefreshCcw} />
                        </div>
                        <div className="flex justify-end items-center space-x-2">
                            <div className="relative group">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all font-black text-xs uppercase tracking-widest"
                                >
                                    <Share2 className="h-4 w-4" />
                                    <span>Exportar Reporte</span>
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                </motion.button>

                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                                    <button onClick={handleExport} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 text-xs font-bold text-gray-700 border-b border-gray-50">
                                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                        <span>Descargar Excel</span>
                                    </button>
                                    <button onClick={handleExportPDF} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 text-xs font-bold text-gray-700">
                                        <FileText className="h-4 w-4 text-rose-600" />
                                        <span>Descargar PDF</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Glassmorphic Configuration Card */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-3xl shadow-lg shadow-gray-200/50 relative overflow-hidden transition-all duration-300">
                <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/50 transition-colors"
                >
                    <div className="flex items-center space-x-3 flex-1" onClick={() => setShowConfig(!showConfig)}>
                        <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600 font-bold text-sm">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <h2 className="text-base font-black text-gray-800 tracking-tight lowercase first-letter:uppercase">Opciones de Conciliación</h2>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowSettingsModal(true); }}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Configurar Origen de Datos"
                        >
                            <Settings className="h-6 w-6" />
                        </button>
                        <button
                            onClick={() => setShowConfig(!showConfig)}
                            className="text-gray-400 hover:text-emerald-600 transition-colors ml-4"
                        >
                            {showConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {showConfig && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-5 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-center relative z-10 border-t border-gray-100/50">
                                <div className="lg:col-span-8 flex flex-col justify-center space-y-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Excepciones</span>
                                    <div className="flex items-center space-x-3 bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 hover:border-emerald-500/10 transition-colors w-full md:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => setExcludeAlmaverde(!excludeAlmaverde)}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${excludeAlmaverde ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                        >
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${excludeAlmaverde ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </button>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ignorar Almaverde Beauty</span>
                                    </div>
                                </div>
                                <div className="lg:col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Desde</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 bg-gray-50/50 border border-gray-100 rounded-xl focus:bg-white focus:border-emerald-500/30 outline-none transition-all font-bold text-xs text-gray-700"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="lg:col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Hasta</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 bg-gray-50/50 border border-gray-100 rounded-xl focus:bg-white focus:border-emerald-500/30 outline-none transition-all font-bold text-xs text-gray-700"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                                <div className="lg:col-span-12 mt-2">
                                    <motion.button
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={handleConciliar}
                                        disabled={loading}
                                        className="w-full py-2.5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                                        <span className="uppercase tracking-widest text-xs">{loading ? "Cruzando..." : "Cruzar Datos"}</span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {data && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-visible"
                >
                    {/* Custom Tabs with Framer Motion Layout - STICKY */}
                    <div className="sticky top-[75px] z-[50] flex items-center px-4 py-2 bg-white/95 backdrop-blur-md border-b border-emerald-50 overflow-x-auto no-scrollbar shadow-md rounded-t-3xl">
                        <div className="flex space-x-2">
                            {[
                                { id: "diferencias", label: "Diferencias", icon: AlertTriangle, count: data.diferencias.length },
                                { id: "solo_siigo", label: "Solo Siigo", icon: XCircle, count: data.solo_siigo.length },
                                { id: "solo_sheets", label: "Solo Sheets", icon: RefreshCcw, count: data.solo_sheets.length },
                                { id: "matched", label: "Coinciden", icon: CheckCircle2, count: data.matched.length }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={getTabStyle(tab.id)}
                                >
                                    <tab.icon className="h-4 w-4" />
                                    <span className="uppercase tracking-wider text-[10px]">{tab.label}</span>
                                    <span className="bg-gray-200/50 px-1.5 py-0.5 rounded-full text-[9px] font-black">{tab.count}</span>
                                    {activeTab === tab.id && (
                                        <motion.div
                                            layoutId="active-tab"
                                            className={`absolute bottom-0 left-0 right-0 h-1 rounded-full ${tab.id === 'matched' ? 'bg-emerald-500' :
                                                tab.id === 'diferencias' ? 'bg-amber-500' :
                                                    tab.id === 'solo_siigo' ? 'bg-rose-500' : 'bg-orange-500'
                                                }`}
                                        />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 min-w-12"></div>

                        {/* Inline Filters */}
                        <div className="hidden md:flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm mr-2">
                            <Search className="h-3.5 w-3.5 text-emerald-600" />
                            <input
                                type="text"
                                placeholder="Factura..."
                                className="w-24 outline-none text-xs font-medium text-gray-700 bg-transparent placeholder-gray-400"
                                value={filterInvoice}
                                onChange={e => setFilterInvoice(e.target.value)}
                            />
                            <div className="w-px h-4 bg-gray-200"></div>
                            <input
                                type="text"
                                placeholder="SKU..."
                                className="w-24 outline-none text-xs font-medium text-gray-700 bg-transparent placeholder-gray-400"
                                value={filterProduct}
                                onChange={e => setFilterProduct(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                onClick={() => setShowEmailModal(true)}
                                className="my-2.5 mr-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center space-x-2 text-[10px] uppercase tracking-widest"
                            >
                                <Mail className="h-3.5 w-3.5" />
                                <span>Enviar</span>
                            </motion.button>
                        </div>
                    </div>

                    <div className="p-0">
                        <div className="overflow-x-auto max-h-[700px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#183C30] sticky top-0 z-20 shadow-md">
                                    <tr>
                                        <th className="px-4 py-3 text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] whitespace-nowrap">Empresa</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] whitespace-nowrap">Documento</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] whitespace-nowrap">Fecha</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] whitespace-nowrap">Cliente</th>
                                        {(activeTab !== "matched") && (
                                            <th className="px-4 py-3 text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] whitespace-nowrap">Novedad Detectada</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 align-top">
                                    <AnimatePresence mode="popLayout">
                                        {activeTab === "diferencias" && getFilteredList(data.diferencias).map((item, i) => (
                                            <motion.tr
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                key={item.invoice + i} className="group hover:bg-amber-50/20 transition-all border-b border-gray-50"
                                            >
                                                <td className="px-4 py-3 text-xs leading-none">
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md font-black text-[9px] uppercase tracking-wider">{item.empresa}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-gray-800 tracking-tight">{item.invoice}</span>
                                                        <span className="text-[9px] font-bold text-amber-600 uppercase">Dif.</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-gray-400 font-medium font-mono whitespace-nowrap">{item.date}</td>
                                                <td className="px-4 py-3 text-xs font-bold text-gray-600 truncate max-w-[150px]">{item.client}</td>
                                                <td className="px-4 py-3">
                                                    <div className="bg-amber-50/50 border border-amber-100 p-2 rounded-xl">
                                                        <ul className="space-y-1">
                                                            {item.diffs.map((d: string, di: number) => (
                                                                <li key={di} className="flex items-start space-x-1.5 text-[10px] font-bold text-amber-800">
                                                                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                                                                    <span>{d}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}

                                        {/* Similar visual improvements for other tabs */}
                                        {activeTab === "solo_siigo" && getFilteredList(data.solo_siigo).map((item, i) => (
                                            <motion.tr
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                key={item.invoice + i} className="group hover:bg-rose-50/20 transition-all border-b border-gray-50"
                                            >
                                                <td className="px-4 py-3 text-xs leading-none"><span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md font-black text-[9px] uppercase tracking-wider">{item.empresa}</span></td>
                                                <td className="px-4 py-3"><span className="text-xs font-black text-gray-800 tracking-tight">{item.invoice}</span></td>
                                                <td className="px-4 py-3 text-[11px] text-gray-400 font-medium font-mono">{item.date}</td>
                                                <td className="px-4 py-3 text-xs font-bold text-gray-600 truncate max-w-[150px]">{item.client}</td>
                                                <td className="px-4 py-3">
                                                    <div className="bg-rose-50/50 border border-rose-100 p-2 rounded-xl flex items-center space-x-2">
                                                        <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                                        <div>
                                                            <p className="text-[9px] font-black text-rose-800 uppercase tracking-wider">Falta en Excel</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}

                                        {activeTab === "solo_sheets" && getFilteredList(data.solo_sheets).map((item, i) => (
                                            <motion.tr
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                key={item.invoice + i} className="group hover:bg-orange-50/20 transition-all border-b border-gray-50"
                                            >
                                                <td className="px-4 py-3 text-xs leading-none"><span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md font-black text-[9px] uppercase tracking-wider">{item.empresa}</span></td>
                                                <td className="px-4 py-3"><span className="text-xs font-black text-gray-800 tracking-tight">{item.invoice}</span></td>
                                                <td className="px-4 py-3 text-[11px] text-gray-400 font-medium font-mono">{item.date}</td>
                                                <td className="px-4 py-3 text-xs font-bold text-gray-600 truncate max-w-[150px]">{item.client}</td>
                                                <td className="px-4 py-3">
                                                    <div className="bg-orange-50/50 border border-orange-100 p-2 rounded-xl flex items-center space-x-2">
                                                        <Search className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                                        <div>
                                                            <p className="text-[9px] font-black text-orange-800 uppercase tracking-wider">Falta en Siigo</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}

                                        {activeTab === "matched" && getFilteredList(data.matched).map((item, i) => (
                                            <motion.tr
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                key={item.invoice + i} className="group hover:bg-emerald-50/10 transition-all border-b border-gray-50"
                                            >
                                                <td className="px-4 py-3 text-xs leading-none"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-black text-[9px] uppercase tracking-wider">{item.empresa}</span></td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center space-x-2">
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                        <span className="text-xs font-black text-gray-800 tracking-tight">{item.invoice}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-gray-400 font-medium font-mono">{item.date}</td>
                                                <td className="px-4 py-3 text-xs font-bold text-gray-600 truncate max-w-[150px]">{item.client}</td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>

                                    {data[activeTab].length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-24 text-center">
                                                <div className="flex flex-col items-center justify-center space-y-4 opacity-30">
                                                    <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                                                    <p className="text-xl font-black text-gray-400 uppercase tracking-tighter">Todo en orden en esta categoría</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>
            )}

            {!data && !loading && (
                <div className="py-24 text-center space-y-4 max-w-md mx-auto opacity-50">
                    <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
                        <Filter className="h-10 w-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-black text-gray-700 uppercase tracking-tight">Listo para procesar</h3>
                    <p className="text-sm font-medium text-gray-400">Asegúrate de tener la URL configurada en las opciones y selecciona el periodo para iniciar el cruce de facturación.</p>
                </div>
            )}

            {/* Email Modal */}
            <AnimatePresence>
                {showEmailModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden relative"
                        >
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-black text-gray-800 tracking-tight">Enviar Resumen</h3>
                                        <p className="text-sm text-gray-500 mt-1 font-medium">Se enviará el detalle de la conciliación a los correos especificados.</p>
                                    </div>
                                    <button onClick={() => setShowEmailModal(false)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-colors">
                                        <XCircle className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Correos Electrónicos</label>
                                        <textarea
                                            className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-gray-700 min-h-[100px] resize-none placeholder:text-gray-300"
                                            placeholder="correo@ejemplo.com, gerencia@origen.com..."
                                            value={emailRecipients}
                                            onChange={(e) => setEmailRecipients(e.target.value)}
                                        />
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleSendEmail}
                                        disabled={sendingEmail || !emailRecipients.trim()}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center space-x-2 disabled:opacity-50 mt-4"
                                    >
                                        {sendingEmail ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                                        <span className="uppercase tracking-widest text-sm">{sendingEmail ? "Enviando..." : "Enviar Correo"}</span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Settings Modal relative to document origin */}
            <AnimatePresence>
                {showSettingsModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden relative"
                        >
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-black text-gray-800 tracking-tight">Configuración del Origen</h3>
                                        <p className="text-sm text-gray-500 mt-1 font-medium">Define desde donde el sistema debe cruzar la información.</p>
                                    </div>
                                    <button onClick={() => setShowSettingsModal(false)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-colors">
                                        <XCircle className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">URL Pública de Google Sheets (Formato CSV o web)</label>
                                        <div className="relative group">
                                            <FileSpreadsheet className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                                            <input
                                                type="text"
                                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500/30 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium text-gray-700 placeholder:text-gray-300"
                                                placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
                                                value={url}
                                                onChange={(e) => setUrl(e.target.value)}
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-bold px-2">Asegúrate de que la hoja de Google Sheets esté publicada en la web.</p>
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setShowSettingsModal(false)}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center space-x-2"
                                    >
                                        <CheckCircle2 className="h-5 w-5" />
                                        <span className="uppercase tracking-widest text-sm">Guardar y Cerrar</span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
