"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_URL } from "@/lib/config";
import {
    Truck,
    Upload,
    Plus,
    Calendar,
    MapPin,
    DollarSign,
    Search,
    FileText,
    MoreHorizontal,
    Loader2,
    CheckCircle,
    XCircle,
    Clock,
    Printer,
    Trash2,
    FileSignature,
    Eye,
    PackageCheck,
    Filter,
    FilePenLine,
    AlertTriangle,
    TrendingUp,
    Award
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function TransportPage() {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Timeline Modal State
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isTimelineOpen, setIsTimelineOpen] = useState(false);

    // New Request State
    const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<any>(null);

    // Action Modal State (Receive / Invoice)
    const [actionModal, setActionModal] = useState<{ type: 'receive' | 'invoice' | null, item: any }>({ type: null, item: null });
    // Stats & KPIs
    const [stats, setStats] = useState({ total: 0, active: 0 });
    const [kpis, setKpis] = useState({ monthSpend: 0, avgCost: 0, topCarrier: "N/A" });
    const [dbStatus, setDbStatus] = useState<any>(null);

    useEffect(() => {
        fetchData();
        checkDbStatus();
    }, []);

    const checkDbStatus = async () => {
        try {
            const res = await axios.get(`${API_URL}/transport/status`);
            setDbStatus(res.data);
        } catch (e) {
            console.error("Status check failed", e);
            setDbStatus({ mode: "Offline/Error", status: "error" });
        }
    };

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const res = await axios.get(`${API_URL}/transport/`);
            setData(res.data);

            // Calc stats
            // Calc stats
            const active = res.data.filter((d: any) => d.status !== 'Entregado y Facturado' && d.status !== 'Cancelado').length;
            setStats({ total: res.data.length, active });

            // Calc KPIs (Current Month)
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const monthData = res.data.filter((d: any) => {
                const dateDate = new Date(d.request_date || d.created_at);
                return dateDate.getMonth() === currentMonth && dateDate.getFullYear() === currentYear;
            });

            const monthSpend = monthData.reduce((acc: number, curr: any) => acc + (Number(curr.transport_cost) || 0), 0);
            const avgCost = monthData.length ? (monthSpend / monthData.length) : 0;

            // Top Carrier
            const carrierCounts: any = {};
            monthData.forEach((d: any) => {
                const c = d.carrier || "Sin asignar";
                carrierCounts[c] = (carrierCounts[c] || 0) + 1;
            });
            const topCarrier = Object.entries(carrierCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "N/A";

            setKpis({ monthSpend, avgCost, topCarrier });

        } catch (e) {
            console.error("Error fetching transport data", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            setIsUploading(true);
            await axios.post(`${API_URL}/transport/upload`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            alert("Archivo importado exitosamente");
            fetchData(); // Refresh
        } catch (error) {
            console.error("Upload error", error);
            alert("Error al subir archivo. Verifica el formato.");
        } finally {
            setIsUploading(false);
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta solicitud?")) return;
        try {
            await axios.delete(`${API_URL}/transport/${id}`);
            fetchData();
        } catch (error) {
            console.error("Error deleting", error);
            alert("Error al eliminar");
        }
    };



    const handleReceive = (item: any) => {
        setActionModal({ type: 'receive', item });
    };

    const handleLoadConfirm = async (item: any) => {
        if (!confirm("¿Confirmar que el vehículo ha cargado y está en tránsito?")) return;
        try {
            await axios.put(`${API_URL}/transport/${item.id}`, {
                status: "En Tránsito",
                actual_load_at: new Date().toISOString()
            });
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Error al actualizar cargue");
        }
    };

    const handleAddInvoice = (item: any) => {
        setActionModal({ type: 'invoice', item });

    };

    const openTimeline = (item: any) => {
        setSelectedRequest(item);
        setIsTimelineOpen(true);
    };


    // Status Badge Helper
    const getStatusColor = (status: string) => {
        const s = (status || "").toLowerCase();
        if (s.includes("facturado")) return "bg-purple-100 text-purple-700 border-purple-200";
        if (s.includes("entregado") || s.includes("finalizado")) return "bg-green-100 text-green-700 border-green-200";
        if (s.includes("pendiente") || s.includes("solicitado")) return "bg-yellow-100 text-yellow-700 border-yellow-200";
        if (s.includes("cancelado")) return "bg-red-50 text-red-600 border-red-100";
        return "bg-gray-100 text-gray-600 border-gray-200";
    };

    const formatDate = (isoString: string) => {
        if (!isoString) return "-";
        try {
            return new Date(isoString).toLocaleString('es-CO', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) { return isoString; }
    };


    const saferLower = (s: any) => (s ? String(s).toLowerCase() : "");

    const [statusFilter, setStatusFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [limit, setLimit] = useState(20);

    const filteredData = data.filter(item => {
        const term = searchTerm.toLowerCase();

        // Date Range
        if (startDate || endDate) {
            const itemDate = new Date(item.request_date || item.created_at).getTime();
            if (startDate && itemDate < new Date(startDate).getTime()) return false;
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // End of day
                if (itemDate > end.getTime()) return false;
            }
        }

        const matchesSearch = !term || (
            saferLower(item.carrier).includes(term) ||
            saferLower(item.origin).includes(term) ||
            saferLower(item.destination).includes(term) ||
            saferLower(item.status).includes(term) ||
            saferLower(item.id).includes(term) ||
            saferLower(item.legacy_id).includes(term) ||
            saferLower(item.rm_number).includes(term) ||
            saferLower(item.invoice_number).includes(term)
        );

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'pending' && (!item.status || item.status.toLowerCase().includes('solicitado') || item.status.toLowerCase().includes('pendiente') || item.status.toLowerCase().includes('transito'))) ||
            (statusFilter === 'delivered' && item.status && item.status.toLowerCase().includes('entregado')) ||
            (statusFilter === 'invoiced' && item.status && item.status.toLowerCase().includes('facturado'));

        return matchesSearch && matchesStatus;
    })
        .sort((a, b) => {
            // Advanced Sort: PRIORITIZE ST-XXX Numeric Sort
            const getSeq = (id: string) => {
                if (typeof id === 'string' && id.startsWith('ST-')) {
                    const num = parseInt(id.split('-')[1]);
                    return isNaN(num) ? -1 : num;
                }
                return -1;
            };

            const seqA = getSeq(a.legacy_id || a.id);
            const seqB = getSeq(b.legacy_id || b.id);

            if (seqA > -1 && seqB > -1) return seqB - seqA; // Descending Numeric

            // Fallback: Date Descending
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        })
        .slice(0, limit);

    return (
        <div className="space-y-6 pb-20 p-6 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-[#183C30] flex items-center gap-2">
                        <Truck className="h-8 w-8 text-green-700" />
                        Gestión de Transporte
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Administra solicitudes, recepciones y facturación.</p>
                    {dbStatus && (
                        <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${dbStatus.status === 'connected' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${dbStatus.status === 'connected' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}></div>
                            {dbStatus.mode}
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".xlsx, .xls"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-4 py-2 bg-white border border-green-200 text-green-700 hover:bg-green-50 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Importar Excel
                    </button>

                    <button
                        onClick={() => {
                            setEditingRequest(null);
                            setIsNewRequestOpen(true);
                        }}
                        className="px-5 py-2 bg-[#183C30] text-white rounded-xl text-sm font-medium hover:bg-[#122e24] transition-colors flex items-center gap-2 shadow-lg shadow-green-900/10">
                        <Plus className="h-4 w-4" />
                        Nueva Solicitud
                    </button>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-blue-400 uppercase font-bold tracking-wider">Total del Mes</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">${kpis.monthSpend.toLocaleString()}</p>
                    </div>
                    <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                        <DollarSign className="h-5 w-5" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-green-400 uppercase font-bold tracking-wider">Costo Promedio</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">${Math.round(kpis.avgCost).toLocaleString()}</p>
                    </div>
                    <div className="h-10 w-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-purple-400 uppercase font-bold tracking-wider">Top Transportador</p>
                        <p className="text-lg font-bold text-purple-600 mt-1 truncate max-w-[150px]" title={kpis.topCarrier}>{kpis.topCarrier}</p>
                    </div>
                    <div className="h-10 w-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                        <Award className="h-5 w-5" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-orange-400 uppercase font-bold tracking-wider">En Tránsito / Pend.</p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">{stats.active}</p>
                    </div>
                    <div className="h-10 w-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                        <Truck className="h-5 w-5" />
                    </div>
                </div>
            </div>

            {/* FILTER SECTION */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col xl:flex-row gap-4 items-center justify-between">

                {/* Search & Status Filter Group */}
                <div className="flex flex-col xl:flex-row items-center gap-4 w-full xl:w-auto">
                    {/* Search Input Moved Here */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#183C30]/20 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Date Filters */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-xs text-gray-400">Desde:</span>
                            <input
                                type="date"
                                className="pl-12 pr-2 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#183C30]"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-xs text-gray-400">Hasta:</span>
                            <input
                                type="date"
                                className="pl-12 pr-2 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#183C30]"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Filter className="h-5 w-5 text-gray-500" />
                        <span className="font-medium text-gray-700 text-sm whitespace-nowrap">Estado:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-[#183C30] focus:border-[#183C30] block w-full md:w-48 p-2 outline-none"
                        >
                            <option value="all">Todos</option>
                            <option value="pending">En Tránsito / Pendientes</option>
                            <option value="delivered">Entregados (RM)</option>
                            <option value="invoiced">Facturados</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
                    <span className="text-sm text-gray-500">Mostrar:</span>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-[#183C30] focus:border-[#183C30] block w-20 p-2 outline-none"
                    >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={10000}>Todos</option>
                    </select>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                {/* Data Grid */}

                {/* Data Grid */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 sticky top-0">
                            <tr>
                                <th className="px-6 py-4">Solicitud</th>
                                <th className="px-6 py-4">Ruta</th>
                                <th className="px-6 py-4">Transportista / Vehículo</th>
                                <th className="px-6 py-4">Valores</th>
                                <th className="px-6 py-4 text-center">Trazabilidad</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-300" />
                                        <p className="mt-2 text-gray-400">Cargando datos...</p>
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-gray-400">
                                        No se encontraron registros.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((item) => {
                                    const isDelayed = item.status === 'Solicitado' && item.scheduled_load_date && new Date(item.scheduled_load_date).getTime() < new Date().setHours(0, 0, 0, 0);

                                    return (
                                        <tr key={item.id} className={`transition-colors group ${isDelayed ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs text-gray-500">{item.legacy_id || ("#" + item.id.substring(0, 6))}</span>
                                                        {isDelayed && (
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold border border-red-200" title="Retraso en Cargue">
                                                                <AlertTriangle className="h-3 w-3" />
                                                                <span>RETRASO</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-gray-900">{item.request_date?.split('T')[0] || item.created_at?.split('T')[0] || "Hoy"}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1 min-w-[150px]">
                                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                        {item.origin || "N/A"}
                                                    </div>
                                                    <div className="h-4 border-l border-dashed border-gray-300 ml-[3px]"></div>
                                                    <div className="flex items-center gap-1 text-xs text-gray-900 font-medium">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                        {item.destination || "N/A"}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-800 text-xs">{item.carrier || "Sin asignar"}</span>
                                                    <span className="text-xs text-gray-500">{item.vehicle_type || "N/A"}</span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {item.merchandise_value ? (
                                                        <div className="flex items-center gap-1 text-green-700 font-medium text-xs">
                                                            <span className="text-green-800/60 font-normal">Aseg:</span>
                                                            ${Number(item.merchandise_value).toLocaleString()}
                                                        </div>
                                                    ) : <span className="text-gray-300 text-xs">-</span>}

                                                    <div className="flex items-center gap-1 text-gray-600 font-medium text-xs">
                                                        <span className="text-gray-400 font-normal">Costo:</span>
                                                        {item.transport_cost ? `$${Number(item.transport_cost).toLocaleString()}` : "--"}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => openTimeline(item)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs rounded-md border border-gray-200 transition-colors"
                                                >
                                                    <Eye className="h-3 w-3" />
                                                    Ver
                                                </button>
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                                                    {item.status || "Solicitado"}
                                                </span>
                                            </td>


                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const url = `${API_URL}/transport/${item.id}/pdf`;
                                                            window.open(url, '_blank');
                                                        }}
                                                        className="p-2 hover:bg-green-50 rounded-lg text-gray-400 hover:text-green-700 transition-colors"
                                                        title="Descargar PDF"
                                                    >
                                                        <Printer className="h-4 w-4" />
                                                    </button>

                                                    {(item.status === 'Solicitado') && (
                                                        <button
                                                            onClick={() => handleLoadConfirm(item)}
                                                            className="p-2 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                                                            title="Confirmar Cargue (Vehículo en sitio)"
                                                        >
                                                            <Truck className="h-4 w-4" />
                                                        </button>
                                                    )}

                                                    {(item.status === 'Solicitado' || item.status === 'En Tránsito' || !item.status) && (
                                                        <button
                                                            onClick={() => handleReceive(item)}
                                                            className="p-2 hover:bg-orange-50 rounded-lg text-gray-400 hover:text-orange-600 transition-colors"
                                                            title="Confirmar Recepción (RM)"
                                                        >
                                                            <PackageCheck className="h-4 w-4" />
                                                        </button>
                                                    )
                                                    }

                                                    <button
                                                        onClick={() => handleAddInvoice(item)}
                                                        className="p-2 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="Radicar Factura"
                                                    >
                                                        <FileSignature className="h-4 w-4" />
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            setEditingRequest(item);
                                                            setIsNewRequestOpen(true);
                                                        }}
                                                        className="p-2 hover:bg-yellow-50 rounded-lg text-gray-400 hover:text-yellow-600 transition-colors"
                                                        title="Editar Solicitud"
                                                    >
                                                        <FilePenLine className="h-4 w-4" />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Eliminar Solicitud"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div >
                                            </td >
                                        </tr >
                                    );
                                })
                            )
                            }
                        </tbody >
                    </table >
                </div >
            </div >

            {/* TIMELINE MODAL */}
            < Dialog open={isTimelineOpen} onOpenChange={setIsTimelineOpen} >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Trazabilidad del Transporte</DialogTitle>
                        <DialogDescription>
                            Solicitud: {selectedRequest?.legacy_id || selectedRequest?.id}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRequest && (
                        <div className="relative py-4 pl-4 space-y-8">
                            {/* LINE */}
                            <div className="absolute left-[22px] top-6 bottom-6 w-0.5 bg-gray-200"></div>

                            {/* STEP 1: SOLICITUD */}
                            <div className="relative flex gap-4">
                                <div className="h-4 w-4 rounded-full bg-green-600 ring-4 ring-white z-10"></div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm text-gray-900">Solicitud Creada</p>
                                    <p className="text-xs text-gray-500">{formatDate(selectedRequest.created_at || selectedRequest.request_date)}</p>
                                </div>
                            </div>

                            {/* STEP 1.5: CARGUE */}
                            <div className="relative flex gap-4">
                                <div className={`h-4 w-4 rounded-full ring-4 ring-white z-10 ${selectedRequest.actual_load_at ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm text-gray-900">Cargue y Despacho</p>
                                    <p className="text-xs text-blue-700 font-medium">Programado: {selectedRequest.scheduled_load_date || "N/A"}</p>
                                    {selectedRequest.actual_load_at ? (
                                        <p className="text-xs text-gray-500">Cargó: {formatDate(selectedRequest.actual_load_at)}</p>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">Pendiente de cargue...</p>
                                    )}
                                </div>
                            </div>
                            {/* STEP 2: RECEPCION */}
                            <div className="relative flex gap-4">
                                <div className={`h-4 w-4 rounded-full ring-4 ring-white z-10 ${selectedRequest.rm_number ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm text-gray-900">Mercancía Recibida</p>
                                    {selectedRequest.rm_number ? (
                                        <>
                                            <p className="text-xs text-green-700 font-mono">RM: {selectedRequest.rm_number}</p>
                                            <p className="text-xs text-gray-500">{formatDate(selectedRequest.delivery_date)}</p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">Pendiente de recepción...</p>
                                    )}
                                </div>
                            </div>

                            {/* STEP 3: FACTURACION */}
                            <div className="relative flex gap-4">
                                <div className={`h-4 w-4 rounded-full ring-4 ring-white z-10 ${selectedRequest.invoice_number ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm text-gray-900">Facturación Transporte</p>
                                    {selectedRequest.invoice_number ? (
                                        <>
                                            <p className="text-xs text-purple-700 font-mono">Factura: {selectedRequest.invoice_number}</p>
                                            <p className="text-xs text-gray-500">{formatDate(selectedRequest.invoice_date)}</p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">Pendiente de facturación...</p>
                                    )}
                                </div>
                            </div>
                        </div >
                    )}
                </DialogContent >
            </Dialog >

            {/* NEW REQUEST MODAL */}
            < CreateRequestModal
                isOpen={isNewRequestOpen}
                editingItem={editingRequest}
                onClose={() => {
                    setIsNewRequestOpen(false);
                    setEditingRequest(null);
                }}
                onSuccess={() => {
                    setIsNewRequestOpen(false);
                    setEditingRequest(null);
                    fetchData();
                }}
            />

            {/* CONFIRMATION MODAL (RECEIVE / INVOICE) */}
            <ConfirmationModal
                isOpen={!!actionModal.type}
                type={actionModal.type}
                item={actionModal.item}
                onClose={() => setActionModal({ type: null, item: null })}
                onSuccess={() => {
                    setActionModal({ type: null, item: null });
                    fetchData();
                }}
            />
        </div >
    );
}

// --- CONFIRMATION MODAL ---
function ConfirmationModal({ isOpen, type, item, onClose, onSuccess }: any) {
    const [value, setValue] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && item) {
            // Pre-fill if editing? For now clean.
            setValue(type === 'receive' ? item.rm_number || "" : item.invoice_number || "");
        }
    }, [isOpen, item, type]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!value) return alert("El campo es obligatorio");

        setLoading(true);
        try {
            const payload: any = {};
            if (type === 'receive') {
                payload.rm_number = value;
                payload.status = "Entregado";
                payload.delivery_date = new Date().toISOString();
            } else {
                payload.invoice_number = value;
                payload.status = "Entregado y Facturado";
                payload.invoice_date = date; // User selected date for invoice
            }

            await axios.put(`${API_URL}/transport/${item.id}`, payload);
            alert("Registro actualizado exitosamente");
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al actualizar");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isReceive = type === 'receive';
    const title = isReceive ? "Confirmar Recepción de Mercancía" : "Radicar Factura de Transporte";
    const label = isReceive ? "Número de Remisión (RM)" : "Número de Factura";
    const colorClass = isReceive ? "text-orange-600 bg-orange-50" : "text-purple-600 bg-purple-50";
    const btnClass = isReceive ? "bg-orange-600 hover:bg-orange-700" : "bg-purple-600 hover:bg-purple-700";

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className={`p-3 w-fit rounded-full mb-2 ${colorClass}`}>
                        {isReceive ? <PackageCheck className="h-6 w-6" /> : <FileSignature className="h-6 w-6" />}
                    </div>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Ingrese los detalles para registrar la {isReceive ? "entrega" : "facturación"} de la solicitud <b>{item.legacy_id || item.id}</b>.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{label} <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-opacity-50 focus:ring-gray-400"
                            placeholder={isReceive ? "Ej: RM-12345" : "Ej: FE-9876"}
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            required
                        />
                    </div>

                    {!isReceive && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Factura</label>
                            <input
                                type="date"
                                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-4 py-2 text-sm text-white rounded-lg transition-colors flex items-center gap-2 ${btnClass}`}
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isReceive ? "Confirmar Entrega" : "Radicar Factura"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
// --- CREATE REQUEST MODAL COMPONENT ---
function CreateRequestModal({ isOpen, onClose, onSuccess, editingItem }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, editingItem?: any }) {
    const [formData, setFormData] = useState({
        origin: "",
        origin_address: "",
        destination: "",
        destination_address: "",
        carrier: "",
        scheduled_load_date: "",
        vehicle_type: "",
        merchandise_value: "",
        transport_cost: "",
        observations: ""
    });
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<{ carriers: any[], locations: any[] }>({ carriers: [], locations: [] });

    useEffect(() => {
        if (isOpen) {
            fetchConfig();
            if (editingItem) {
                setFormData({
                    origin: editingItem.origin || "",
                    origin_address: editingItem.origin_address || "",
                    destination: editingItem.destination || "",
                    destination_address: editingItem.destination_address || "",
                    carrier: editingItem.carrier || "",
                    scheduled_load_date: editingItem.scheduled_load_date || "",
                    vehicle_type: editingItem.vehicle_type || "",
                    merchandise_value: editingItem.merchandise_value || "",
                    transport_cost: editingItem.transport_cost || "",
                    observations: editingItem.observations || ""
                });
            } else {
                // Reset
                setFormData({
                    origin: "",
                    origin_address: "",
                    destination: "",
                    destination_address: "",
                    carrier: "",
                    scheduled_load_date: "",
                    vehicle_type: "",
                    merchandise_value: "",
                    transport_cost: "",
                    observations: ""
                });
            }
        }
    }, [isOpen, editingItem]);

    const fetchConfig = async () => {
        try {
            const res = await axios.get(`${API_URL}/transport/config`);
            setConfig(res.data);
        } catch (e) {
            console.error("Config fetch error", e);
        }
    };

    const handleLocationChange = (field: 'origin' | 'destination', value: string) => {
        const selectedLoc = config.locations.find((l: any) => l.name === value);
        const address = selectedLoc ? selectedLoc.address : "";
        setFormData(prev => ({
            ...prev,
            [field]: value,
            [`${field}_address`]: address
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.origin || !formData.destination || !formData.carrier || !formData.scheduled_load_date) {
            alert("Por favor complete los campos obligatorios");
            return;
        }

        try {
            setLoading(true);
            if (editingItem) {
                await axios.put(`${API_URL}/transport/${editingItem.id}`, formData);
                alert("Solicitud actualizada exitosamente");
            } else {
                await axios.post(`${API_URL}/transport/`, formData);
                alert("Solicitud creada exitosamente");
            }

            onSuccess();
        } catch (error) {
            console.error("Save error", error);
            alert("Error al guardar solicitud");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingItem ? "Editar Solicitud" : "Nueva Solicitud de Transporte"}</DialogTitle>
                    <DialogDescription>{editingItem ? "Modifique la información de la solicitud." : "Diligencie la información para programar un despacho."}</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                        {/* ORIGIN */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Origen <span className="text-red-500">*</span></label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#183C30] outline-none"
                                value={formData.origin}
                                onChange={e => handleLocationChange('origin', e.target.value)}
                                required
                            >
                                <option value="">Seleccione Origen...</option>
                                {config.locations.map((loc: any) => (
                                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                                ))}
                                <option value="Otro">Otro / Manual</option>
                            </select>
                            {formData.origin === 'Otro' && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Nombre del Origen"
                                        className="mt-2 w-full border border-gray-300 rounded-lg p-2 text-sm"
                                        onChange={e => setFormData({ ...formData, origin: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Dirección exacta"
                                        className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm"
                                        onChange={e => setFormData({ ...formData, origin_address: e.target.value })}
                                    />
                                </>
                            )}
                            {formData.origin !== 'Otro' && formData.origin && (
                                <p className="text-xs text-gray-500 mt-1 truncate">{formData.origin_address}</p>
                            )}
                        </div>

                        {/* DESTINATION */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Destino <span className="text-red-500">*</span></label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#183C30] outline-none"
                                value={formData.destination}
                                onChange={e => handleLocationChange('destination', e.target.value)}
                                required
                            >
                                <option value="">Seleccione Destino...</option>
                                {config.locations.map((loc: any) => (
                                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                                ))}
                                <option value="Otro">Otro / Manual</option>
                            </select>
                            {formData.destination === 'Otro' && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Nombre del Destino"
                                        className="mt-2 w-full border border-gray-300 rounded-lg p-2 text-sm"
                                        onChange={e => setFormData({ ...formData, destination: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Dirección exacta"
                                        className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm"
                                        onChange={e => setFormData({ ...formData, destination_address: e.target.value })}
                                    />
                                </>
                            )}
                            {formData.destination !== 'Otro' && formData.destination && (
                                <p className="text-xs text-gray-500 mt-1 truncate">{formData.destination_address}</p>
                            )}
                        </div>

                        {/* SCHEDULED DATE */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">F. Programada Cargue <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="date"
                                    className="w-full pl-9 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#183C30] outline-none"
                                    value={formData.scheduled_load_date}
                                    onChange={e => setFormData({ ...formData, scheduled_load_date: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Transportadora <span className="text-red-500">*</span></label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#183C30] outline-none"
                                value={formData.carrier}
                                onChange={e => setFormData({ ...formData, carrier: e.target.value })}
                                required
                            >
                                <option value="">Seleccione...</option>
                                {config.carriers.map((c: any) => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Vehículo</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#183C30] outline-none"
                                value={formData.vehicle_type}
                                onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })}
                            >
                                <option value="">Seleccione...</option>
                                <option value="Turbo">Turbo</option>
                                <option value="Sencillo">Sencillo</option>
                                <option value="Dobletroque">Dobletroque</option>
                                <option value="Mula">Mula</option>
                                <option value="Furgon">Furgon</option>
                                <option value="Particular">Particular</option>
                            </select>
                        </div>

                        {/* VALUES - SPLIT IN TWO */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Valor Mercancía</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="number"
                                    className="w-full pl-9 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#183C30] outline-none"
                                    placeholder="0"
                                    value={formData.merchandise_value}
                                    onChange={e => setFormData({ ...formData, merchandise_value: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Costo Transporte</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-green-600" />
                                <input
                                    type="number"
                                    className="w-full pl-9 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#183C30] outline-none"
                                    placeholder="Valor Flete"
                                    value={formData.transport_cost}
                                    onChange={e => setFormData({ ...formData, transport_cost: e.target.value })}
                                />
                            </div>
                        </div>
                    </div >

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                        <textarea
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#183C30] outline-none h-20 resize-none"
                            placeholder="Instrucciones adicionales..."
                            value={formData.observations}
                            onChange={e => setFormData({ ...formData, observations: e.target.value })}
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-[#183C30] text-white hover:bg-[#122e24] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {editingItem ? "Actualizar Solicitud" : "Crear Solicitud"}
                        </button>
                    </div>
                </form >
            </DialogContent >
        </Dialog >
    );
}
