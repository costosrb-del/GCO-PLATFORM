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
    Filter
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

    // Stats
    const [stats, setStats] = useState({ total: 0, active: 0 });
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
            const active = res.data.filter((d: any) => d.status !== 'Entregado y Facturado' && d.status !== 'Cancelado').length;
            setStats({ total: res.data.length, active });

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

    const handleReceive = async (item: any) => {
        const rm = prompt("Ingrese el Número de Remisión (RM) para confirmar recepción:", item.rm_number || "");
        if (rm === null) return;
        if (!rm) {
            alert("El número de RM es obligatorio para recibir.");
            return;
        }

        try {
            await axios.put(`${API_URL}/transport/${item.id}`, {
                rm_number: rm,
                status: "Entregado",
                delivery_date: new Date().toISOString()
            });
            fetchData();
        } catch (error) {
            console.error("Error receiving", error);
            alert("Error al confirmar recepción");
        }
    };

    const handleAddInvoice = async (item: any) => {
        const invoice = prompt("Ingrese el número de Factura de Proveedor:", item.invoice_number || "");
        if (invoice === null) return; // Cancelled
        if (!invoice) {
            alert("El número de factura es obligatorio.");
            return;
        }

        try {
            await axios.put(`${API_URL}/transport/${item.id}`, {
                invoice_number: invoice,
                status: "Entregado y Facturado",
                invoice_date: new Date().toISOString()
            });
            fetchData();
        } catch (error) {
            console.error("Error updating invoice", error);
            alert("Error al actualizar factura");
        }
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
    const [limit, setLimit] = useState(20);

    const filteredData = data.filter(item => {
        const term = searchTerm.toLowerCase();
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
    }).slice(0, limit);

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

                    <button className="px-5 py-2 bg-[#183C30] text-white rounded-xl text-sm font-medium hover:bg-[#122e24] transition-colors flex items-center gap-2 shadow-lg shadow-green-900/10">
                        <Plus className="h-4 w-4" />
                        Nueva Solicitud
                    </button>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Total Visibles / Total Global</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <p className="text-3xl font-bold text-gray-800">{filteredData.length}</p>
                            <span className="text-sm text-gray-400 font-medium">/ {stats.total}</span>
                        </div>
                    </div>
                    <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                        <FileText className="h-5 w-5" />
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-orange-400 uppercase font-bold tracking-wider">En Tránsito / Pendientes</p>
                        <p className="text-3xl font-bold text-orange-600 mt-1">{stats.active}</p>
                    </div>
                    <div className="h-10 w-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                        <Truck className="h-5 w-5" />
                    </div>
                </div>
            </div>

            {/* FILTER SECTION */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-gray-500" />
                        <span className="font-medium text-gray-700 text-sm">Estado:</span>
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-[#183C30] focus:border-[#183C30] block w-full md:w-48 p-2.5 outline-none"
                    >
                        <option value="all">Todos</option>
                        <option value="pending">En Tránsito / Pendientes</option>
                        <option value="delivered">Entregados (RM)</option>
                        <option value="invoiced">Facturados</option>
                    </select>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <span className="text-sm text-gray-500">Mostrar:</span>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-[#183C30] focus:border-[#183C30] block w-24 p-2.5 outline-none"
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
                {/* Search */}
                <div className="p-4 border-b border-gray-100 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por ID, placa, RM, factura..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#183C30]/20 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

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
                                filteredData.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs text-gray-500">{item.legacy_id || ("#" + item.id.substring(0, 6))}</span>
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

                                                {(item.status === 'Solicitado' || item.status === 'En Transito' || !item.status) && (
                                                    <button
                                                        onClick={() => handleReceive(item)}
                                                        className="p-2 hover:bg-orange-50 rounded-lg text-gray-400 hover:text-orange-600 transition-colors"
                                                        title="Confirmar Recepción (RM)"
                                                    >
                                                        <PackageCheck className="h-4 w-4" />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => handleAddInvoice(item)}
                                                    className="p-2 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="Radicar Factura"
                                                >
                                                    <FileSignature className="h-4 w-4" />
                                                </button>

                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Eliminar Solicitud"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TIMELINE MODAL */}
            <Dialog open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
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
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );
}
