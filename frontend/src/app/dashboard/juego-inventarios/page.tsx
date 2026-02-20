"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, RefreshCcw, Download, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, Filter, ArrowUpDown, TrendingUp, TrendingDown, Lock, Unlock, Calendar, FileText as FilePdf } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_URL } from "@/lib/config";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GCOProgress } from "@/components/ui/GCOProgress";
import { GCOError } from "@/components/ui/GCOError";

interface JuegoItem {
    sku: string;
    name: string;
    initial_balance: number;
    entries: number;
    exits: number;
    final_balance: number;
    current_siigo_stock?: number;
    difference?: number;
    alert?: string;
    audit?: string;
}

const LOADING_STEPS = [
    "Conectando con Google Sheets (Saldos Iniciales)...",
    "Obteniendo inventario en tiempo real desde Siigo...",
    "Analizando movimientos de facturación y notas...",
    "Calculando diferencias y generando auditoría...",
    "Finalizando reporte..."
];

export default function JuegoInventariosPage() {
    const [data, setData] = useState<JuegoItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState("");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'alert' | 'ok' | 'missing' | 'surplus'>('all');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    const [selectedItem, setSelectedItem] = useState<JuegoItem | null>(null);
    const [errors, setErrors] = useState<string[]>([]);

    // Monthly State
    const [activeMonth, setActiveMonth] = useState<string>("");
    const [isClosing, setIsClosing] = useState(false);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem("gco_token");
            const res = await axios.get(`${API_URL}/juego-inventario/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveMonth(res.data.active_month);
        } catch (e) { console.error("Error fetching status", e); }
    };

    // fetchData function
    const fetchData = async () => {
        let stepIndex = 0;
        // Start loading sequence
        setIsLoading(true);
        setLoadingStatus(LOADING_STEPS[0]);
        setErrors([]);

        // Timer to simulate progress steps (since backend is sync)
        const intervalId = setInterval(() => {
            stepIndex++;
            if (stepIndex < LOADING_STEPS.length) {
                setLoadingStatus(LOADING_STEPS[stepIndex]);
            }
        }, 2500); // Change message every 2.5 seconds

        try {
            const token = localStorage.getItem("gco_token");
            if (!token) {
                alert("No session found");
                return;
            }

            const response = await axios.get(`${API_URL}/juego-inventario/?company_index=0`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data) {
                if (response.data.data) setData(response.data.data);
                if (response.data.errors) setErrors(response.data.errors);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            alert("Error al cargar el Juego de Inventarios. Verifique la conexión.");
        } finally {
            clearInterval(intervalId);
            setIsLoading(false);
            setLoadingStatus("");
        }
    };

    useEffect(() => {
        fetchStatus();
        // fetchData(); -> Se quita ejecución automática, el usuario debe oprimir "Actualizar Reporte"
    }, []);

    const getMonthName = (monthStr: string) => {
        if (!monthStr) return "...";
        try {
            const [year, month] = monthStr.split('-');
            return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('es-CO', { month: 'long', year: 'numeric' }).toUpperCase();
        } catch (e) { return monthStr; }
    };

    const exportToPDF = (customData?: JuegoItem[]) => {
        const reportData = customData || data;
        if (reportData.length === 0) return;

        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setTextColor(24, 60, 48); // #183C30
        doc.text("Juego de Inventarios - Reporte Mensual", 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Mes: ${getMonthName(activeMonth)}`, 14, 30);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 35);

        const tableColumn = ["SKU", "Nombre", "S. Inicial", "Entradas", "Salidas", "Calculado", "Siigo", "Diff"];
        const tableRows: any[] = [];

        reportData.forEach(item => {
            const rowData = [
                item.sku,
                item.name.substring(0, 30),
                formatNumber(item.initial_balance),
                formatNumber(item.entries),
                formatNumber(item.exits),
                formatNumber(item.final_balance),
                formatNumber(item.current_siigo_stock || 0),
                formatNumber(item.difference || 0)
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'striped',
            headStyles: { fillColor: [24, 60, 48] },
            styles: { fontSize: 8 }
        });

        doc.save(`Juego_Inventarios_${activeMonth}.pdf`);
    };

    const handleCloseMonth = async () => {
        const confirmMsg = `¿ESTÁS SEGURO DE CERRAR EL MES DE ${getMonthName(activeMonth)}?\n\n` +
            "Se descargarán los informes finales y el sistema pasará al siguiente mes.\n" +
            "SOLO HAZ ESTO SI EL MES HA TERMINADO Y LOS MOVIMIENTOS ESTÁN AL DÍA.";

        if (!confirm(confirmMsg)) return;

        try {
            setIsClosing(true);
            const token = localStorage.getItem("gco_token");
            const res = await axios.post(`${API_URL}/juego-inventario/close?company_index=0`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data) {
                // 1. Export both with the closed data
                const closedData = res.data.data;
                exportToExcel(closedData);
                exportToPDF(closedData);

                // 2. Update State
                setActiveMonth(res.data.new_month);
                setData(closedData);
                alert(`¡Mes de ${getMonthName(res.data.closed_month)} cerrado exitosamente!\nAhora visualizando ${getMonthName(res.data.new_month)}.`);

                // 3. Refresh to get fresh movements for new month
                fetchData();
            }
        } catch (error: any) {
            console.error("Close Error:", error);
            alert("Error al cerrar el mes: " + (error.response?.data?.detail || "Error desconocido"));
        } finally {
            setIsClosing(false);
        }
    };

    const exportToExcel = (customData?: JuegoItem[]) => {
        const reportData = customData || data;
        if (reportData.length === 0) return;

        const worksheet = XLSX.utils.json_to_sheet(reportData.map(item => ({
            "SKU": item.sku,
            "Nombre": item.name,
            "Saldo Inicial": item.initial_balance,
            "Entradas": item.entries,
            "Salidas (Fact - NC)": item.exits,
            "Saldo Final (Teorico)": item.final_balance,
            "Stock Siigo (Actual)": item.current_siigo_stock || 0,
            "Diferencia": item.difference || 0,
            "Alerta": item.alert || "OK",
            "Auditoria": item.audit || ""
        })));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Juego Inventarios");
        XLSX.writeFile(workbook, `Juego_Inventarios_Comparativo_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const formatNumber = (val: number) => {
        return new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(val);
    };

    const getRowColor = (diff: number) => {
        const absDiff = Math.abs(diff);
        if (absDiff < 0.01) return "bg-green-50/50 hover:bg-green-50";
        if (absDiff < 10) return "bg-yellow-50/50 hover:bg-yellow-50";
        if (absDiff < 50) return "bg-orange-50/50 hover:bg-orange-50";
        return "bg-red-50/50 hover:bg-red-50";
    };

    const getDiffBadge = (diff: number) => {
        const absDiff = Math.abs(diff);
        if (absDiff < 0.01) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">Perfecto</span>;
        if (absDiff < 10) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">Baja</span>;
        if (absDiff < 50) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">Media</span>;
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 animate-pulse">CRÍTICA</span>;
    };

    const filteredAndSortedData = data.filter(item => {
        const diff = item.difference || 0;
        const absDiff = Math.abs(diff);
        const hasDiff = absDiff > 0.01;

        if (filterType === 'alert') return hasDiff;
        if (filterType === 'ok') return !hasDiff;
        if (filterType === 'missing') return diff > 0.01; // Teo > Real (Faltante en sistema)
        if (filterType === 'surplus') return diff < -0.01; // Teo < Real (Sobrante en sistema)
        return true;
    }).sort((a, b) => {
        const diffA = Math.abs(a.difference || 0);
        const diffB = Math.abs(b.difference || 0);
        return sortOrder === 'desc' ? diffB - diffA : diffA - diffB;
    });

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen relative">
            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#183C30]/10 backdrop-blur-sm p-6">
                    <GCOProgress
                        progress={((LOADING_STEPS.indexOf(loadingStatus) + 1) / LOADING_STEPS.length) * 100}
                        message={loadingStatus}
                        submessage="Este proceso audita miles de facturas y notas crédito para detectar discrepancias."
                        className="w-full max-w-lg"
                    />
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-[#183C30]">Juego de Inventarios (Comparativo)</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm font-semibold text-gray-700">
                            Comparando: Saldo Teórico vs Stock Siigo (Principal, Rionegro, Comercio Ext, Avería)
                        </span>
                        {lastUpdated && (
                            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                                Actualizado: {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 shadow-sm">
                        <Calendar className="h-4 w-4" />
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold opacity-60 leading-none">Mes Activo</span>
                            <span className="text-sm font-bold">{getMonthName(activeMonth)}</span>
                        </div>
                    </div>

                    <button
                        onClick={fetchData}
                        disabled={isLoading || isClosing}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-[#183C30] transition-colors disabled:opacity-50"
                    >
                        <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline font-medium">Actualizar</span>
                    </button>

                    <button
                        onClick={() => exportToPDF()}
                        disabled={data.length === 0 || isLoading || isClosing}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                        <FilePdf className="h-4 w-4" />
                        <span className="hidden sm:inline font-medium">PDF</span>
                    </button>

                    <button
                        onClick={() => exportToExcel()}
                        disabled={data.length === 0 || isLoading || isClosing}
                        className="flex items-center gap-2 px-4 py-2 bg-[#183C30] text-white rounded-xl hover:bg-[#122e24] transition-all shadow-lg shadow-[#183C30]/20 disabled:opacity-50 disabled:shadow-none"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span className="hidden sm:inline font-medium">Excel</span>
                    </button>

                    <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>

                    <button
                        onClick={handleCloseMonth}
                        disabled={isLoading || isClosing}
                        className="flex items-center gap-2 px-5 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-900/10 disabled:opacity-50 font-bold"
                    >
                        {isClosing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                        Cerrar Mes
                    </button>
                </div>
            </div>

            {/* Dashboard Stats */}
            {data.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Precisión */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Meta: 100%</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Precisión Global</p>
                            <h3 className="text-2xl font-bold text-[#183C30]">
                                {((data.filter(i => Math.abs(i.difference || 0) < 0.01).length / data.length) * 100).toFixed(1)}%
                            </h3>
                        </div>
                    </div>

                    {/* Card 2: SKUs Alertados */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-yellow-50 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">SKUs a Revisar</p>
                            <h3 className="text-2xl font-bold text-yellow-700">
                                {data.filter(i => Math.abs(i.difference || 0) >= 0.01).length}
                            </h3>
                        </div>
                    </div>

                    {/* Card 3: Faltantes (Loss) */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-red-50 rounded-lg z-10">
                                <TrendingDown className="h-5 w-5 text-red-600" />
                            </div>
                            <span className="text-xs font-bold text-red-600 z-10">MENOR EN SIIGO</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500" title="Calculado vs Saldo Teórico">Faltante en Sistema</p>
                            <h3 className="text-2xl font-bold text-red-600">
                                {formatNumber(data.reduce((acc, curr) => {
                                    const diff = (curr.final_balance || 0) - (curr.current_siigo_stock || 0); // Teo - Real
                                    return diff > 0.01 ? acc + diff : acc;
                                }, 0))}
                            </h3>
                        </div>
                    </div>

                    {/* Card 4: Sobrantes (Surplus) */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-blue-50 rounded-lg z-10">
                                <TrendingUp className="h-5 w-5 text-blue-600" />
                            </div>
                            <span className="text-xs font-bold text-blue-600 z-10">MAYOR EN SIIGO</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500" title="Calculado vs Saldo Teórico">Sobrante en Sistema</p>
                            <h3 className="text-2xl font-bold text-blue-600">
                                {formatNumber(data.reduce((acc, curr) => {
                                    const diff = (curr.current_siigo_stock || 0) - (curr.final_balance || 0); // Real - Teo
                                    return diff > 0.01 ? acc + diff : acc;
                                }, 0))}
                            </h3>
                        </div>
                    </div>
                </div>
            )}

            {/* Config & Filters */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Filtrar por:</span>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'all' ? 'bg-white text-[#183C30] shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterType('alert')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'alert' ? 'bg-white text-yellow-600 shadow-sm ring-1 ring-yellow-100' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Con Diferencias
                        </button>
                        <button
                            onClick={() => setFilterType('missing')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'missing' ? 'bg-white text-red-600 shadow-sm ring-1 ring-red-100' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Faltantes
                        </button>
                        <button
                            onClick={() => setFilterType('surplus')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'surplus' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Sobrantes
                        </button>
                        <button
                            onClick={() => setFilterType('ok')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterType === 'ok' ? 'bg-white text-green-600 shadow-sm ring-1 ring-green-100' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Correctos
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:ml-auto">
                    <ArrowUpDown className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Ordenar por Diferencia:</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="text-xs font-medium bg-gray-50 border border-gray-200"
                    >
                        {sortOrder === 'desc' ? 'Mayor a Menor (Críticas primero)' : 'Menor a Mayor'}
                    </Button>
                </div>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <GCOError
                    message="Análisis de inventario parcial"
                    details={errors}
                    className="mb-8"
                />
            )}
            {/* Content */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {isLoading && data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400 min-h-[400px]">
                        <p>Esperando datos...</p>
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <p>No se encontraron datos.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">SKU</th>
                                    <th className="px-6 py-4 font-semibold">Nombre</th>
                                    <th className="px-6 py-4 font-semibold text-right text-gray-500">Saldo Inicial</th>
                                    <th className="px-6 py-4 font-semibold text-right text-gray-500">Entradas</th>
                                    <th className="px-6 py-4 font-semibold text-right text-gray-500">Salidas</th>
                                    <th className="px-6 py-4 font-semibold text-right text-[#183C30] bg-gray-100">Saldo Final (Teorico)</th>
                                    <th className="px-6 py-4 font-semibold text-right text-blue-800 bg-blue-50">Stock Siigo</th>
                                    <th className="px-6 py-4 font-semibold text-right">Diferencia</th>
                                    <th className="px-6 py-4 font-semibold text-center">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredAndSortedData.map((item, idx) => {
                                    const diff = item.difference || 0;
                                    const hasDiff = Math.abs(diff) > 0.01;
                                    return (
                                        <tr key={`${item.sku}-${idx}`} className={`transition-colors border-l-4 ${hasDiff ? 'border-l-red-400' : 'border-l-green-400'} ${getRowColor(diff)}`}>
                                            <td className="px-6 py-4 font-medium text-gray-900">{item.sku}</td>
                                            <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate" title={item.name}>{item.name}</td>
                                            <td className="px-6 py-4 text-right text-gray-400">{formatNumber(item.initial_balance)}</td>
                                            <td className="px-6 py-4 text-right text-gray-400">+{formatNumber(item.entries)}</td>
                                            <td className="px-6 py-4 text-right text-gray-400">-{formatNumber(item.exits)}</td>
                                            <td className="px-6 py-4 text-right font-medium text-[#183C30]">{formatNumber(item.final_balance)}</td>
                                            <td className="px-6 py-4 text-right font-bold text-blue-700">
                                                {formatNumber(item.current_siigo_stock || 0)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`font-bold ${hasDiff ? 'text-red-600' : 'text-green-600'}`}>
                                                        {formatNumber(diff)}
                                                    </span>
                                                    {getDiffBadge(diff)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedItem(item)}
                                                    className="hover:bg-[#183C30]/10 text-[#183C30]"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#183C30] flex items-center gap-2">
                            <span className="bg-[#183C30] text-white text-xs px-2 py-1 rounded">SKU: {selectedItem?.sku}</span>
                            <span>{selectedItem?.name}</span>
                        </DialogTitle>
                        <DialogDescription>
                            Detalle de movimientos y stock consolidado
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 space-y-4">
                        {!selectedItem?.audit ? (
                            <p className="text-gray-500 italic">No hay información de auditoría disponible.</p>
                        ) : (
                            selectedItem.audit.split('\n').map((line, idx) => {
                                const trimLine = line.trim();
                                if (!trimLine) return null;

                                // Headers (=== TITULO ===)
                                if (trimLine.startsWith('===')) {
                                    const title = trimLine.replace(/===/g, '').trim();
                                    return (
                                        <div key={idx} className="bg-gray-100 p-2 rounded-lg font-semibold text-[#183C30] border-l-4 border-[#183C30] mt-4 first:mt-0">
                                            {title}
                                        </div>
                                    );
                                }

                                // List Items
                                // Check for Transaction Type coloring
                                const isOut = trimLine.includes("(SALIDA)");
                                const isIn = trimLine.includes("(ENTRADA)") || trimLine.includes("Stock Siigo");

                                return (
                                    <div key={idx} className={`text-sm px-3 py-1.5 border-b border-gray-50 flex items-start gap-2 ${isOut ? "bg-red-50/50 text-red-700" :
                                        isIn ? "bg-green-50/50 text-green-700" : "text-gray-600"
                                        }`}>
                                        <div className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${isOut ? "bg-red-400" : isIn ? "bg-green-400" : "bg-gray-300"
                                            }`} />
                                        <span className="font-mono text-xs md:text-sm break-all">
                                            {trimLine}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

