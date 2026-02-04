"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_URL } from "@/lib/config";
import { Search, ArrowRight, Truck, Package, Clock, Calculator, Loader2, AlertTriangle, CheckCircle, Info, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { SALES_CODES } from "@/lib/constants";

interface DistributionProposal {
    sku: string;
    source_stock: number;
    source_audit?: string;
    total_needed: number;
    fill_ratio: number;
    distribution: {
        company: string;
        current_stock: number;
        average_daily: number;
        days_remaining: number;
        needed: number;
        suggested: number;
        reason: string;
    }[];
}

interface BatchResponse {
    count: number;
    time_taken: number;
    results: DistributionProposal[];
}

export default function DistributionPage() {
    const [sku, setSku] = useState("");
    const [daysGoal, setDaysGoal] = useState<number>(15);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [streamedBatchData, setStreamedBatchData] = useState<BatchResponse | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [mode, setMode] = useState<"single" | "batch">("batch");

    const [filterCompany, setFilterCompany] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all"); // all, urgent, actionable, stockout
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'priority', direction: 'asc' });

    // Single Query
    const { data: singleData, isLoading: isSingleLoading, isError: isSingleError, error: singleError, refetch: refetchSingle, isRefetching: isSingleRefetching } = useQuery<DistributionProposal>({
        queryKey: ["distribution", sku, daysGoal],
        queryFn: async () => {
            if (!sku) return null;
            const token = localStorage.getItem("gco_token");
            const res = await axios.get(`${API_URL}/distribution/proposal`, {
                params: { sku, days_goal: daysGoal },
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        },
        enabled: false
    });

    const handleSearch = () => {
        if (!searchTerm) return;

        // If we have batch data and the term is in it, strict filter is handled by render
        if (mode === "batch" && streamedBatchData?.results.some(r => r.sku === searchTerm)) {
            return;
        }

        setMode("single");
        setSku(searchTerm);
        setTimeout(() => refetchSingle(), 100);
    };

    const handleBatchAnalysis = async () => {
        setMode("batch");
        setIsStreaming(true);
        setStreamedBatchData(null);
        setErrorMsg(null);
        setLoadingProgress(0);
        setLoadingMessage("Conectando...");
        setFilterCompany("all");
        setFilterStatus("all");

        try {
            const token = localStorage.getItem("gco_token");
            if (!token) throw new Error("No session token");

            const skus_str = SALES_CODES.join(",");
            const url = `${API_URL}/distribution/proposal/batch/stream?days_goal=${daysGoal}&skus=${encodeURIComponent(skus_str)}`;

            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                const txt = await response.text();
                throw new Error(`Error ${response.status}: ${txt}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error("No reader");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const jsonStr = line.replace("data: ", "");
                        try {
                            const event = JSON.parse(jsonStr);

                            if (event.error) {
                                throw new Error(event.message || "Error en el servidor");
                            }

                            setLoadingProgress(event.progress);
                            setLoadingMessage(event.message);

                            if (event.data) {
                                setStreamedBatchData(event.data);
                            }
                        } catch (e: any) {
                            if (e.message && !e.message.includes("JSON")) {
                                throw e;
                            }
                            console.error("JSON Error", e);
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error(e);
            setErrorMsg(e.message);
        } finally {
            setIsStreaming(false);
            setLoadingProgress(0);
        }
    };

    // Auto-run batch on mount if default mode
    useEffect(() => {
        if (mode === "batch" && !streamedBatchData && !isStreaming) {
            handleBatchAnalysis();
        }
    }, []); // Run once

    // Combined Loading & Error States
    const isLoading = isSingleLoading || isSingleRefetching || isStreaming;
    const error = isSingleError ? singleError?.message : errorMsg;

    // Sorting Helper
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return <span className="text-gray-300 ml-1">↕</span>;
        return <span className="text-white ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    // Helper for days badge
    const getDaysBadge = (days: number, avg: number) => {
        if (days === 0) {
            if (avg === 0) return <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">AGOTADO</span>;
            return <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-bold">AGOTADO</span>;
        }
        if (days < 5) return <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-bold">{days.toFixed(1)}d</span>;
        if (days < 15) return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">{days.toFixed(1)}d</span>;
        return <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">{days.toFixed(1)}d</span>;
    };

    const getExportData = () => {
        if (!streamedBatchData) return [];

        const exportRows: any[] = [];

        streamedBatchData.results.forEach(p => {
            // 1. Recalculate Logic (Same as Render)
            let totalNeededForSku = 0;
            p.distribution.forEach(d => {
                const targetQty = d.average_daily * daysGoal;
                const needed = Math.max(0, targetQty - d.current_stock);
                totalNeededForSku += needed;
            });

            let fillRatio = 0.0;
            if (totalNeededForSku > 0) {
                fillRatio = (p.source_stock >= totalNeededForSku) ? 1.0 : (p.source_stock / totalNeededForSku);
            }

            p.distribution.forEach(d => {
                const targetQty = d.average_daily * daysGoal;
                const needed = Math.max(0, targetQty - d.current_stock);
                let suggested = 0;
                if (needed > 0) suggested = Math.floor(needed * fillRatio);

                if (suggested > 0) {
                    exportRows.push({
                        SKU: p.sku,
                        "Origen": "Bodega Principal",
                        "Destino": d.company,
                        "Enviar": suggested,
                        "Prioridad": (d.days_remaining < 5 && d.average_daily > 0) ? "Alta" : "Normal",
                        "Stock": d.current_stock,
                        "Venta_Dia": d.average_daily.toFixed(2),
                        "Dias_Restantes": d.days_remaining.toFixed(1)
                    });
                }
            });
        });
        return exportRows;
    };

    const handleExport = (format: 'excel' | 'pdf' | 'csv') => {
        const data = getExportData();
        if (data.length === 0) return;
        const dateStr = new Date().toISOString().split('T')[0];

        if (format === 'excel' || format === 'csv') {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Distribucion");
            const ext = format === 'excel' ? 'xlsx' : 'csv';
            XLSX.writeFile(wb, `Plan_Distribucion_${dateStr}.${ext}`);
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.text(`Plan de Distribución - ${dateStr}`, 14, 15);
            doc.setFontSize(10);
            doc.text(`Meta: ${daysGoal} días | Total Referencias: ${data.length}`, 14, 22);

            autoTable(doc, {
                startY: 25,
                head: [['SKU', 'Destino', 'Enviar', 'Prioridad', 'Stock', 'Venta/Día']],
                body: data.map(r => [r.SKU, r.Destino, r.Enviar, r.Prioridad, r.Stock, r.Venta_Dia]),
            });
            doc.save(`Plan_Distribucion_${dateStr}.pdf`);
        }
        setIsExportMenuOpen(false);
    };

    // Render Single Proposal
    const renderProposal = (data: DistributionProposal) => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-[#183C30] flex items-center gap-2">
                    <Package className="h-5 w-5 text-gray-400" />
                    SKU: {data.sku}
                </h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${data.fill_ratio >= 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    Cobertura: {(data.fill_ratio * 100).toFixed(0)}%
                </span>
            </div>

            {/* Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <span className="text-xs font-bold text-blue-700 uppercase block mb-1">Origen (Libre)</span>
                    <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-blue-900">{data.source_stock.toLocaleString()} unds</span>
                    </div>
                </div>

                <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                    <span className="text-xs font-bold text-orange-700 uppercase block mb-1">Necesidad Total</span>
                    <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-orange-900">{Math.ceil(data.total_needed).toLocaleString()} unds</span>
                    </div>
                </div>

                <div className="bg-gray-100 p-4 rounded-xl border border-gray-200">
                    <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Queda en Libre</span>
                    <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-gray-700">
                            {Math.max(0, data.source_stock - data.distribution.reduce((acc, curr) => acc + curr.suggested, 0)).toLocaleString()} unds
                        </span>
                    </div>
                </div>
            </div>

            {/* Distribution Table */}
            <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                    <thead className="bg-[#183C30]/5 text-[#183C30] font-semibold text-xs uppercase">
                        <tr>
                            <th className="px-4 py-2 text-left">Empresa</th>
                            <th className="px-4 py-2 text-center">Stock</th>
                            <th className="px-4 py-2 text-center">Venta/Dia</th>
                            <th className="px-4 py-2 text-center">Días</th>
                            <th className="px-4 py-2 text-center">Necesidad</th>
                            <th className="px-4 py-2 text-center bg-green-50">Sugerido</th>
                            <th className="px-4 py-2 text-left">Razón</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.distribution.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium text-gray-900 line-clamp-1 text-xs">{item.company}</td>
                                <td className="px-4 py-2 text-center text-gray-500 text-xs">{item.current_stock.toLocaleString()}</td>
                                <td className="px-4 py-2 text-center text-gray-500 text-xs">{item.average_daily.toFixed(1)}</td>
                                <td className="px-4 py-2 text-center">{getDaysBadge(item.days_remaining, item.average_daily)}</td>
                                <td className="px-4 py-2 text-center font-medium text-orange-600 text-xs">{Math.ceil(item.needed)}</td>
                                <td className="px-4 py-2 text-center font-bold text-[#183C30] bg-green-50/30">
                                    {item.suggested > 0 ? `+${item.suggested}` : '-'}
                                </td>
                                <td className="px-4 py-2 text-[10px] text-gray-500 italic">
                                    {item.reason}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Extract companies for filter
    const availableCompanies = Array.from(new Set(streamedBatchData?.results.flatMap(r => r.distribution.map(d => d.company)) || [])).sort();

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h1 className="text-2xl font-bold text-[#183C30] mb-2 flex items-center gap-2">
                    <Truck className="h-6 w-6" /> Distribución Inteligente
                </h1>
                <p className="text-gray-500 text-sm mb-6">
                    Herramienta para calcular el reabastecimiento óptimo de bodegas basado en la velocidad de venta de cada empresa.
                </p>

                <div className="flex flex-col xl:flex-row gap-4 xl:items-end">
                    <div className="flex-1 space-y-2 w-full xl:w-auto">
                        <label className="text-xs font-bold text-gray-500 uppercase">Buscador Individual</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Ej: 7901"
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#183C30]/20 font-mono"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 w-full xl:w-48">
                        <label className="text-xs font-bold text-gray-500 uppercase">Filtrar Empresa</label>
                        <select
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#183C30]/20 text-sm"
                            value={filterCompany}
                            onChange={(e) => setFilterCompany(e.target.value)}
                        >
                            <option value="all">Todas las Empresas</option>
                            {availableCompanies.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2 w-full xl:w-48">
                        <label className="text-xs font-bold text-gray-500 uppercase">Filtrar Estado</label>
                        <select
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#183C30]/20 text-sm"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">Todos</option>
                            <option value="actionable">Sugeridos (Enviar)</option>
                            <option value="agotado">Agotados (Sin Stock)</option>
                            <option value="critical">Críticos (Rojo)</option>
                        </select>
                    </div>

                    <div className="space-y-2 w-full md:w-32">
                        <label className="text-xs font-bold text-gray-500 uppercase">Meta (Días)</label>
                        <input
                            type="number"
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#183C30]/20 font-bold text-center"
                            value={daysGoal}
                            onChange={(e) => setDaysGoal(Number(e.target.value))}
                            min={1}
                            max={90}
                        />
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                            disabled={!streamedBatchData || isLoading}
                            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg shadow-green-900/10 disabled:opacity-50 disabled:grayscale"
                        >
                            <Download className="h-4 w-4" />
                            Exportar
                        </button>

                        {isExportMenuOpen && (
                            <div className="absolute top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                                <button onClick={() => handleExport('excel')} className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel (.xlsx)
                                </button>
                                <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4 text-blue-600" /> CSV
                                </button>
                                <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4 text-red-600" /> PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Results */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-sm animate-pulse">
                    <span className="text-gray-600 font-bold mb-2">{loadingMessage} {loadingProgress > 0 ? `${loadingProgress}%` : ''}</span>

                    {isStreaming && (
                        <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-[#183C30] transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
                        </div>
                    )}
                    <span className="text-gray-400 text-xs mt-2">Esto puede tomar hasta 2-3 minutos la primera vez.</span>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Error generando propuesta: {error}
                </div>
            )}

            {/* Single Mode Result */}
            {mode === "single" && singleData && !isLoading && renderProposal(singleData)}

            {/* Batch Mode Consolidated Table */}
            {mode === "batch" && streamedBatchData && !isLoading && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-700">Plan de Reabastecimiento Consolidado</h2>
                        <span className="text-xs text-gray-400">
                            {/* Stats */}
                            {streamedBatchData.count} Refs | Tiempo: {streamedBatchData.time_taken.toFixed(2)}s
                        </span>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-[#183C30] text-white font-semibold text-xs uppercase cursor-pointer select-none">
                                <tr>
                                    <th className="px-6 py-4 text-left hover:bg-green-900 transition-colors" onClick={() => handleSort('sku')}>
                                        Referencia {getSortIndicator('sku')}
                                    </th>
                                    <th className="px-6 py-4 text-center hover:bg-green-900 transition-colors" onClick={() => handleSort('source')}>
                                        Disponible (Bodega) {getSortIndicator('source')}
                                    </th>
                                    <th className="px-6 py-4 text-left hover:bg-green-900 transition-colors" onClick={() => handleSort('company')}>
                                        Destino {getSortIndicator('company')}
                                    </th>
                                    <th className="px-6 py-4 text-center hover:bg-green-900 transition-colors" onClick={() => handleSort('dest_stock')}>
                                        Stock en Tienda {getSortIndicator('dest_stock')}
                                    </th>
                                    <th className="px-6 py-4 text-center hover:bg-green-900 transition-colors" onClick={() => handleSort('average_daily')}>
                                        Venta/Día {getSortIndicator('average_daily')}
                                    </th>
                                    <th className="px-6 py-4 text-center hover:bg-green-900 transition-colors" onClick={() => handleSort('days')}>
                                        Días Restantes {getSortIndicator('days')}
                                    </th>
                                    <th className="px-6 py-4 text-center hover:bg-green-900 transition-colors bg-green-900/40" onClick={() => handleSort('suggested')}>
                                        Cantidad a Enviar {getSortIndicator('suggested')}
                                    </th>
                                    <th className="px-6 py-4 text-left hover:bg-green-900 transition-colors" onClick={() => handleSort('priority')}>
                                        Estado (Prioridad) {getSortIndicator('priority')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(() => {
                                    // Flutter the hierarchical data into a flat list of suggestions
                                    type Row = {
                                        sku: string;
                                        source: number;
                                        company: string;
                                        dest_stock: number;
                                        days: number;
                                        needed: number;
                                        suggested: number;
                                        reason: string;
                                        fill_ratio: number;
                                        average_daily: number;
                                    };

                                    const rows: Row[] = [];

                                    // Client-side Recalculation based on daysGoal
                                    // We need to re-group by SKU to calculate fill ratios per SKU
                                    const skuGroups: { [key: string]: { proposal: any, distribution: any[] } } = {};

                                    streamedBatchData.results.forEach(p => {
                                        if (searchTerm && !p.sku.includes(searchTerm)) return;

                                        // 1. Recalculate Needed for ALL companies for this SKU first
                                        let totalNeededForSku = 0;
                                        const recalcDistribution = p.distribution.map(d => {
                                            const targetQty = d.average_daily * daysGoal;
                                            const needed = Math.max(0, targetQty - d.current_stock);
                                            totalNeededForSku += needed;

                                            // Recalc days remaining (just for display, static based on stock)
                                            // d.days_remaining is static from backend based on snapshot, 
                                            // but conceptually days remaining doesn't change with GOAL, receiving only NEED changes.

                                            return {
                                                ...d,
                                                needed: needed,
                                                target_qty: targetQty
                                            };
                                        });

                                        // 2. Calculate Fill Ratio for this SKU
                                        let fillRatio = 1.0;
                                        if (totalNeededForSku > 0) {
                                            if (p.source_stock >= totalNeededForSku) {
                                                fillRatio = 1.0;
                                            } else {
                                                fillRatio = p.source_stock / totalNeededForSku;
                                            }
                                        } else {
                                            fillRatio = 0.0;
                                        }

                                        // 3. Distribute & Build Rows
                                        let remainingSource = p.source_stock;
                                        recalcDistribution.forEach(d => {
                                            // Company Filter
                                            if (filterCompany !== "all" && d.company !== filterCompany) return;

                                            // Calculate Suggestion
                                            let suggested = 0;
                                            if (d.needed > 0) {
                                                suggested = Math.floor(d.needed * fillRatio);
                                            }

                                            // Status Logic
                                            const isAgotado = d.needed > 0 && p.source_stock === 0;
                                            const hasAction = suggested > 0;
                                            const isCritical = d.days_remaining < 5 && d.days_remaining >= 0;

                                            if (filterStatus === "actionable" && !hasAction) return;
                                            if (filterStatus === "agotado" && !isAgotado) return;
                                            if (filterStatus === "critical" && !isCritical) return;

                                            // Reason Logic (simplified for client)
                                            let reason = d.reason;
                                            if (d.days_remaining < 5) reason = "Crítico (< 5d)";
                                            else if (d.days_remaining < daysGoal / 2) reason = "Bajo Stock";
                                            else reason = "Normal";

                                            rows.push({
                                                sku: p.sku,
                                                source: p.source_stock,
                                                company: d.company,
                                                dest_stock: d.current_stock,
                                                days: d.days_remaining,
                                                needed: d.needed, // Recalculated
                                                suggested: suggested, // Recalculated
                                                reason: reason,
                                                fill_ratio: fillRatio,
                                                average_daily: d.average_daily
                                            });
                                        });
                                    });

                                    // Sorting Logic
                                    rows.sort((a, b) => {
                                        const { key, direction } = sortConfig || { key: 'priority', direction: 'asc' };
                                        let comparison = 0;

                                        if (key === 'priority') {
                                            // Default Priority Logic
                                            const isAgotadoA = a.needed > 0 && a.source === 0;
                                            const isAgotadoB = b.needed > 0 && b.source === 0;
                                            if (isAgotadoA && !isAgotadoB) comparison = -1;
                                            else if (!isAgotadoA && isAgotadoB) comparison = 1;
                                            else {
                                                if (Math.abs(a.days - b.days) > 0.1) comparison = a.days - b.days;
                                                else comparison = b.needed - a.needed;
                                            }
                                        } else {
                                            // Dynamic Sort
                                            // @ts-ignore
                                            const valA = a[key as keyof Row];
                                            // @ts-ignore
                                            const valB = b[key as keyof Row];

                                            if (typeof valA === 'string' && typeof valB === 'string') {
                                                comparison = valA.localeCompare(valB);
                                            } else {
                                                comparison = (Number(valA) || 0) - (Number(valB) || 0);
                                            }
                                        }

                                        return direction === 'asc' ? comparison : -comparison;
                                    });

                                    return rows.map((row, idx) => {
                                        const isAgotado = row.needed > 0 && row.source === 0;
                                        const hasAction = row.suggested > 0;
                                        const noAction = !isAgotado && !hasAction;

                                        // Style classes
                                        let bgClass = "bg-white";
                                        let textClass = "text-gray-900";

                                        if (isAgotado) {
                                            bgClass = "bg-red-50";
                                            textClass = "text-red-900";
                                        } else if (noAction) {
                                            bgClass = "bg-gray-50/50";
                                            textClass = "text-gray-400";
                                        }

                                        return (
                                            <tr key={idx} className={`hover:bg-gray-50 transition-colors ${bgClass} ${textClass}`}>
                                                <td className="px-6 py-3 font-bold border-r border-gray-100">
                                                    {row.sku}
                                                </td>
                                                <td className="px-6 py-3 text-center font-medium border-r border-gray-100 text-blue-700">
                                                    {row.source.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-3 font-medium">
                                                    {row.company}
                                                </td>
                                                <td className="px-6 py-3 text-center font-mono text-gray-600">
                                                    {row.dest_stock.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-3 text-center font-mono text-gray-500 text-xs">
                                                    {row.average_daily.toFixed(2)}
                                                    {/* Sparkline Placeholder */}
                                                    <div className="h-1 w-12 bg-gray-100 mt-1 mx-auto rounded overflow-hidden">
                                                        <div className="h-full bg-blue-400" style={{ width: `${Math.min(100, row.average_daily * 10)}%` }}></div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    {getDaysBadge(row.days, row.average_daily)}
                                                </td>
                                                <td className={`px-6 py-3 text-center font-bold text-base`}>
                                                    {isAgotado ? (
                                                        <span className="text-red-600 text-xs font-black uppercase tracking-wider">¡AGOTADO!</span>
                                                    ) : (
                                                        <span className={row.suggested > 0 ? 'text-[#183C30] bg-green-50 px-2 py-1 rounded' : 'text-gray-300'}>
                                                            {row.suggested > 0 ? `+${row.suggested}` : '-'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-xs italic">
                                                    <span className={`px-2 py-1 rounded-full ${row.reason.includes("Crítico") ? 'bg-red-100 text-red-700' :
                                                        row.reason.includes("Bajo") ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-gray-100 text-gray-500'
                                                        }`}>
                                                        {row.reason}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
