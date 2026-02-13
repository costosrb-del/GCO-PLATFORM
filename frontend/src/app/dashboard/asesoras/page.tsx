"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "@/lib/config";
import {
    UserPlus, Building2, MapPin, Phone, Mail, FileText, CheckCircle2,
    Loader2, AlertCircle, ArrowRight, UserCheck, Search, Users,
    Filter, X, Download, FilterX, RefreshCcw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GCOProgress } from "@/components/ui/GCOProgress";
import { GCOError } from "@/components/ui/GCOError";

const COMPANIES = [
    "ARMONIA C.",
    "HECHIZO DE BELLEZA",
    "RAICES ORGANICAS",
    "RITUAL BOTANICO",
    "GRUPO HUMAN",
    "ALMAVERDE"
];

const CATEGORIES = [
    "Grande",
    "Mediano",
    "Pequeño 1",
    "Pequeño 2",
    "Pequeño 3"
];

const DEPARTMENTS = [
    "AMAZONAS", "ANTIOQUIA", "ARAUCA", "ATLÁNTICO", "BOGOTÁ D.C.", "BOLÍVAR", "BOYACÁ",
    "CALDAS", "CAQUETÁ", "CASANARE", "CAUCA", "CESAR", "CHOCÓ", "CÓRDOBA",
    "CUNDINAMARCA", "GUAINÍA", "GUAVIARE", "HUILA", "LA GUAJIRA", "MAGDALENA",
    "META", "NARIÑO", "NORTE DE SANTANDER", "PUTUMAYO", "QUINDÍO", "RISARALDA",
    "SAN ANDRÉS Y PROVIDENCIA", "SANTANDER", "SUCRE", "TOLIMA", "VALLE DEL CAUCA",
    "VAUPÉS", "VICHADA"
];

const DEPT_COMPANY_MAP: Record<string, string> = {
    "ANTIOQUIA": "RAICES ORGANICAS",
    "CHOCÓ": "RAICES ORGANICAS",
    "BOGOTÁ D.C.": "HECHIZO DE BELLEZA",
    "CUNDINAMARCA": "HECHIZO DE BELLEZA",
    "META": "HECHIZO DE BELLEZA",
    "TOLIMA": "HECHIZO DE BELLEZA",
    "ARAUCA": "HECHIZO DE BELLEZA",
    "CASANARE": "HECHIZO DE BELLEZA",
    "HUILA": "HECHIZO DE BELLEZA",
    "BOYACÁ": "HECHIZO DE BELLEZA",
    "GUAVIARE": "HECHIZO DE BELLEZA",
    "CAQUETÁ": "HECHIZO DE BELLEZA",
    "GUAINÍA": "HECHIZO DE BELLEZA",
    "AMAZONAS": "HECHIZO DE BELLEZA",
    "VICHADA": "HECHIZO DE BELLEZA",
    "VAUPÉS": "HECHIZO DE BELLEZA",
    "SAN ANDRÉS Y PROVIDENCIA": "HECHIZO DE BELLEZA",
    "SANTANDER": "ARMONIA C.",
    "NORTE DE SANTANDER": "ARMONIA C.",
    "VALLE DEL CAUCA": "GRUPO HUMAN",
    "ATLÁNTICO": "GRUPO HUMAN",
    "BOLÍVAR": "GRUPO HUMAN",
    "RISARALDA": "GRUPO HUMAN",
    "CESAR": "GRUPO HUMAN",
    "NARIÑO": "GRUPO HUMAN",
    "CALDAS": "GRUPO HUMAN",
    "LA GUAJIRA": "GRUPO HUMAN",
    "QUINDÍO": "GRUPO HUMAN",
    "CAUCA": "GRUPO HUMAN",
    "MAGDALENA": "GRUPO HUMAN",
    "CÓRDOBA": "GRUPO HUMAN",
    "SUCRE": "GRUPO HUMAN",
    "PUTUMAYO": "GRUPO HUMAN"
};

import ColombiaMap from "@/components/ColombiaMap";

export default function AsesorasPage() {
    // UI State
    const [viewMode, setViewMode] = useState<"list" | "create" | "map">("map");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // Data State
    const [clients, setClients] = useState<any[]>([]);
    const [filteredClients, setFilteredClients] = useState<any[]>([]);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Filter State
    const [filters, setFilters] = useState({
        search: "",
        empresa: "",
        categoria: "",
        ciudad: "",
        departamento: ""
    });

    // Map state
    const [allClientCounts, setAllClientCounts] = useState<Record<string, number>>({});
    const [fetchingStats, setFetchingStats] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        nit: "",
        nombre: "",
        telefono: "",
        correo: "",
        categoria: CATEGORIES[0],
        empresa: COMPANIES[0],
        ciudad: "",
        departamento: ""
    });

    const fetchMapStats = async () => {
        setFetchingStats(true);
        const token = localStorage.getItem("gco_token");
        try {
            const res = await axios.get(`${API_URL}/api/clients/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllClientCounts(res.data);
        } catch (err) {
            console.error("Error fetching map stats", err);
        } finally {
            setFetchingStats(false);
        }
    };

    const handleMapDeptClick = (deptName: string) => {
        setFilters({ ...filters, departamento: deptName });
        setPage(0);
        setViewMode("list");
    };

    const handleDepartmentChange = (dept: string) => {
        let suggestedCompany = DEPT_COMPANY_MAP[dept] || "";
        if (dept === "ANTIOQUIA" || dept === "CHOCÓ") {
            suggestedCompany = "";
        }
        setFormData({
            ...formData,
            departamento: dept,
            empresa: suggestedCompany
        });
    };

    useEffect(() => {
        fetchClients();
    }, [viewMode, page]);

    useEffect(() => {
        fetchMapStats();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [filters, clients]);

    const fetchClients = async (forcedPage?: number) => {
        setFetching(true);
        const token = localStorage.getItem("gco_token");
        try {
            const limit = 100;
            const targetPage = forcedPage !== undefined ? forcedPage : page;
            const offset = targetPage * limit;

            const params: any = { limit, offset };
            if (filters.search) params.search = filters.search;
            if (filters.empresa && filters.empresa !== "") params.empresa = filters.empresa;
            if (filters.categoria && filters.categoria !== "") params.categoria = filters.categoria;
            if (filters.ciudad) params.ciudad = filters.ciudad;
            if (filters.departamento) params.departamento = filters.departamento;

            const res = await axios.get(`${API_URL}/api/clients`, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            if (res.data.length < limit) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }

            setClients(res.data);
            setFilteredClients(res.data);
        } catch (err) {
            console.error("Error fetching clients", err);
        } finally {
            setFetching(false);
        }
    };

    const applyFilters = (data?: any[]) => {
        setFilteredClients(data || clients);
    };

    const handleSearchClick = () => {
        setPage(0);
        fetchClients(0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        const token = localStorage.getItem("gco_token");
        if (!token) {
            setError("Su sesión ha expirado. Por favor inicie sesión nuevamente.");
            setLoading(false);
            return;
        }

        try {
            const res = await axios.post(`${API_URL}/api/clients`, formData, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.data.status === "success") {
                setSuccess(res.data.cuc);
                setFormData({
                    nit: "", nombre: "", telefono: "", correo: "",
                    categoria: CATEGORIES[0], empresa: COMPANIES[0],
                    ciudad: "", departamento: ""
                });
            }
        } catch (err: any) {
            console.error(err);
            if (err.response?.status === 409) {
                // NIT Duplicado
                try {
                    const detail = typeof err.response.data.detail === 'string'
                        ? JSON.parse(err.response.data.detail)
                        : err.response.data.detail;

                    setError(`⚠️ ${detail.message}`);

                    if (detail.client_data) {
                        const existing = detail.client_data;
                        // Populate form with existing data to show user
                        // Normalizar keys mayusculas/minusculas
                        const getV = (k: string) => {
                            const found = Object.keys(existing).find(x => x.toLowerCase() === k.toLowerCase());
                            return found ? String(existing[found]) : "";
                        };

                        setFormData({
                            nit: getV("nit"),
                            nombre: getV("nombre"),
                            telefono: getV("telefono"),
                            correo: getV("correo"),
                            categoria: getV("categoria") || CATEGORIES[0],
                            empresa: getV("empresa") || COMPANIES[0],
                            ciudad: getV("ciudad"),
                            departamento: getV("departamento")
                        });
                        // Opcional: Cambiar a modo vista de lista filtrada por ese NIT?
                        // Mejor dejarlo en el form para que vea los datos.
                    }
                } catch (parseErr) {
                    setError("El cliente ya existe (Error parseando detalles).");
                }
            } else {
                setError(err.response?.data?.detail || "Error al registrar el cliente.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const resetFilters = () => {
        setFilters({ search: "", empresa: "", categoria: "", ciudad: "", departamento: "" });
        setPage(0);
    };

    return (
        <div className="p-6 md:p-10 space-y-8 bg-[#F8FAFC] min-h-screen">
            {/* Header / Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#183C30] flex items-center gap-3">
                        <Users className="h-8 w-8 text-green-600" />
                        Gestión de Clientes
                    </h1>
                    <p className="text-gray-500 mt-1">Administre y registre clientes en la base de datos maestra.</p>
                </div>

                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 self-start">
                    <button
                        onClick={() => setViewMode("list")}
                        className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${viewMode === "list" ? "bg-[#183C30] text-white shadow-lg" : "text-gray-500 hover:bg-gray-50"}`}
                    >
                        <Search className="h-4 w-4" />
                        Ver Listado
                    </button>
                    <button
                        onClick={() => setViewMode("map")}
                        className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${viewMode === "map" ? "bg-[#183C30] text-white shadow-lg" : "text-gray-500 hover:bg-gray-50"}`}
                    >
                        <MapPin className="h-4 w-4" />
                        Ver Mapa
                    </button>
                    <button
                        onClick={() => setViewMode("create")}
                        className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${viewMode === "create" ? "bg-[#183C30] text-white shadow-lg" : "text-gray-500 hover:bg-gray-50"}`}
                    >
                        <UserPlus className="h-4 w-4" />
                        Nuevo Cliente
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {viewMode === "map" ? (
                    <motion.div
                        key="map"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full"
                    >
                        <ColombiaMap
                            onDeptClick={handleMapDeptClick}
                            clientCounts={allClientCounts}
                            onRefresh={fetchMapStats}
                            isRefreshing={fetchingStats}
                        />
                    </motion.div>
                ) : viewMode === "list" ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                    >
                        {/* Filter Bar */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
                            <div className="flex items-center gap-2 text-[#183C30] font-bold">
                                <Filter className="h-4 w-4" />
                                Filtros de Búsqueda
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="space-y-1 lg:col-span-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Búsqueda General (Nombre/NIT/CUC)</label>
                                    <div className="relative flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input
                                                name="search"
                                                value={filters.search}
                                                onChange={handleFilterChange}
                                                onKeyDown={(e) => e.key === "Enter" && handleSearchClick()}
                                                placeholder="Escribe y presiona Enter..."
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500 transition-all outline-none text-sm"
                                            />
                                        </div>
                                        <button
                                            onClick={handleSearchClick}
                                            className="bg-[#183C30] text-white px-4 rounded-xl hover:bg-green-900 transition-colors"
                                        >
                                            <Search className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Empresa</label>
                                    <select
                                        name="empresa"
                                        value={filters.empresa}
                                        onChange={handleFilterChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500 transition-all outline-none text-sm"
                                    >
                                        <option value="">Todas</option>
                                        {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Categoría</label>
                                    <select
                                        name="categoria"
                                        value={filters.categoria}
                                        onChange={handleFilterChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500 transition-all outline-none text-sm"
                                    >
                                        <option value="">Todas</option>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div className="flex items-end gap-2">
                                    <button
                                        onClick={resetFilters}
                                        className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                                    >
                                        <FilterX className="h-4 w-4" />
                                        Limpiar
                                    </button>
                                    <button
                                        onClick={() => fetchClients()}
                                        className="p-3 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-all shadow-sm border border-green-200"
                                        title="Actualizar Datos"
                                    >
                                        <RefreshCcw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Results Table */}
                        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50">
                                            <th className="p-5 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">CUC</th>
                                            <th className="p-5 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Cliente / NIT</th>
                                            <th className="p-5 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Empresa / Cat.</th>
                                            <th className="p-5 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Ubicación</th>
                                            <th className="p-5 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Contacto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {fetching ? (
                                            <tr>
                                                <td colSpan={5} className="p-20">
                                                    <GCOProgress
                                                        progress={60}
                                                        message="Sincronizando Base de Datos Maestra..."
                                                        submessage="Recuperando más de 13,000 registros para traerte la información más actualizada."
                                                    />
                                                </td>
                                            </tr>
                                        ) : filteredClients.length > 0 ? (
                                            filteredClients.map((client, idx) => {
                                                const getV = (k: string) => {
                                                    const found = Object.keys(client).find(x => x.toLowerCase() === k.toLowerCase());
                                                    return found ? String(client[found]) : "";
                                                };
                                                return (
                                                    <tr key={idx} className="hover:bg-green-50/30 transition-colors group">
                                                        <td className="p-5">
                                                            <span className="font-mono font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                                                {getV("cuc")}
                                                            </span>
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="font-bold text-[#183C30]">{getV("nombre")}</div>
                                                            <div className="text-xs text-gray-400 font-medium mt-0.5">{getV("nit")}</div>
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="text-sm font-bold text-gray-700">{getV("empresa")}</div>
                                                            <div className="text-[10px] font-black text-blue-500 uppercase mt-1">{getV("categoria")}</div>
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="text-sm text-gray-600">{getV("ciudad")}</div>
                                                            <div className="text-xs text-gray-400">{getV("departamento")}</div>
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                                <Phone className="h-3 w-3" />
                                                                {getV("telefono")}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                                                <Mail className="h-3 w-3" />
                                                                {getV("correo")}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="p-32 text-center">
                                                    <div className="max-w-md mx-auto">
                                                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                                            <Search className="h-10 w-10 text-gray-200" />
                                                        </div>
                                                        <h3 className="text-xl font-black text-[#183C30] mb-2 tracking-tight">No encontramos coincidencias</h3>
                                                        <p className="text-sm text-gray-400 font-medium leading-relaxed">
                                                            Verifica que el NIT o nombre esté bien escrito. Si buscas en toda la base de datos (13k+), recuerda presionar <b>Enter</b> o la lupa.
                                                        </p>
                                                        <button
                                                            onClick={resetFilters}
                                                            className="mt-6 text-green-600 font-black text-[10px] uppercase tracking-widest hover:text-green-700 transition-all border-b-2 border-green-100 pb-1"
                                                        >
                                                            Limpiar todos los filtros
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-4 order-2 md:order-1">
                                    <button
                                        disabled={page === 0 || fetching}
                                        onClick={() => setPage(p => p - 1)}
                                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all flex items-center gap-2"
                                    >
                                        <ArrowRight className="h-4 w-4 rotate-180" />
                                        Anterior
                                    </button>
                                    <div className="text-sm font-bold text-[#183C30] bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                                        PÁGINA {page + 1}
                                    </div>
                                    <button
                                        disabled={!hasMore || fetching}
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all flex items-center gap-2"
                                    >
                                        Siguiente
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="flex flex-col items-end order-1 md:order-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Base de Datos Maestra</span>
                                    <span className="text-xs font-bold text-[#183C30]">{fetching ? "Sincronizando..." : `Mostrando ${filteredClients.length} registros`}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="create"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="max-w-4xl mx-auto"
                    >
                        {success ? (
                            <div className="bg-white rounded-3xl shadow-xl shadow-green-900/5 p-12 text-center border border-green-50 animate-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
                                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                                </div>
                                <h2 className="text-3xl font-black text-[#183C30] mb-3">¡Registro Completado!</h2>
                                <p className="text-gray-500 mb-8 max-w-sm mx-auto font-medium">El cliente ha sido agregado a la hoja de Google Sheets y se le ha asignado su CUC.</p>

                                <div className="bg-green-50 rounded-[2rem] p-8 mb-10 border border-green-100 transform hover:scale-105 transition-transform">
                                    <span className="text-xs font-black text-green-700 uppercase tracking-[0.2em] block mb-2">CUC ASIGNADO</span>
                                    <span className="text-5xl font-black text-green-900 font-mono tracking-widest">{success}</span>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setSuccess(null)}
                                        className="flex-1 py-4 bg-[#183C30] text-white rounded-2xl font-bold hover:bg-[#1f4d3d] transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                                    >
                                        Registrar Otro
                                        <UserPlus className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode("list")}
                                        className="flex-1 py-4 bg-white border-2 border-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        Ir al Listado
                                        <ArrowRight className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                                <div className="bg-[#183C30] p-8 flex items-center justify-between text-white">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                            <UserPlus className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black uppercase tracking-tight">Nuevo Registro Maestro</h2>
                                            <p className="text-green-200/70 text-xs font-bold uppercase tracking-widest">Base de Datos de Clientes</p>
                                        </div>
                                    </div>
                                    <X
                                        onClick={() => setViewMode("list")}
                                        className="h-6 w-6 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"
                                    />
                                </div>

                                <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8">
                                    {error && (
                                        <GCOError
                                            message="Error al registrar cliente"
                                            details={error}
                                        />
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Row 1 */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">NIT / No. Identificación</label>
                                            <div className="relative group">
                                                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 group-focus-within:text-green-600 transition-colors" />
                                                <input required name="nit" value={formData.nit} onChange={(e) => setFormData({ ...formData, nit: e.target.value })} placeholder="Ej: 900500123" className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all outline-none font-medium" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Nombre Completo / Razón Social</label>
                                            <div className="relative group">
                                                <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 group-focus-within:text-green-600 transition-colors" />
                                                <input required name="nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Nombre del cliente" className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all outline-none font-medium" />
                                            </div>
                                        </div>

                                        {/* Row 2 */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Teléfono de Contacto</label>
                                            <div className="relative group">
                                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 group-focus-within:text-green-600 transition-colors" />
                                                <input required name="telefono" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="300 000 0000" className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all outline-none font-medium" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Correo Electrónico</label>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 group-focus-within:text-green-600 transition-colors" />
                                                <input required name="correo" type="email" value={formData.correo} onChange={(e) => setFormData({ ...formData, correo: e.target.value })} placeholder="cliente@ejemplo.com" className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all outline-none font-medium" />
                                            </div>
                                        </div>

                                        {/* Row 3 */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">
                                                Empresa Solicitante
                                                {(formData.departamento === "ANTIOQUIA" || formData.departamento === "CHOCÓ") &&
                                                    <span className="text-red-500 ml-1 font-black underline">(OBLIGATORIO: ELIJA RAICES O RITUAL)</span>
                                                }
                                            </label>
                                            <div className="relative group">
                                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 group-focus-within:text-green-600 transition-colors" />
                                                <select
                                                    required
                                                    name="empresa"
                                                    value={formData.empresa}
                                                    onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                                                    className={`w-full pl-12 pr-4 py-4 bg-gray-50/50 border rounded-2xl focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all outline-none font-bold appearance-none ${!formData.empresa ? 'border-red-200 text-red-400' : 'border-gray-100 text-gray-700'}`}
                                                >
                                                    <option value="">Seleccione Empresa...</option>
                                                    {COMPANIES.filter(c => {
                                                        const dept = formData.departamento;
                                                        if (dept === "ANTIOQUIA" || dept === "CHOCÓ") {
                                                            return c === "RAICES ORGANICAS" || c === "RITUAL BOTANICO";
                                                        }
                                                        if (DEPT_COMPANY_MAP[dept]) {
                                                            return c === DEPT_COMPANY_MAP[dept];
                                                        }
                                                        return true; // Si no hay regla, mostrar todas
                                                    }).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Categoría del Cliente</label>
                                            <div className="relative group">
                                                <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 group-focus-within:text-green-600 transition-colors" />
                                                <select name="categoria" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all outline-none font-bold text-gray-700 appearance-none">
                                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Row 4 */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Ciudad de Residencia</label>
                                            <div className="relative group">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 group-focus-within:text-green-600 transition-colors" />
                                                <input required name="ciudad" value={formData.ciudad} onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })} placeholder="Ej: Bogotá" className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all outline-none font-medium" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Departamento</label>
                                            <div className="relative group">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 group-focus-within:text-green-600 transition-colors" />
                                                <select
                                                    required
                                                    name="departamento"
                                                    value={formData.departamento}
                                                    onChange={(e) => handleDepartmentChange(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all outline-none font-bold text-gray-700 appearance-none"
                                                >
                                                    <option value="">Seleccione Departamento</option>
                                                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        disabled={loading}
                                        type="submit"
                                        className="w-full py-6 bg-[#183C30] text-white rounded-3xl font-black text-xl hover:bg-[#1f4d3d] transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4 shadow-2xl shadow-green-900/40"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-7 w-7 animate-spin text-green-300" />
                                                GENERANDO CUC Y GUARDANDO...
                                            </>
                                        ) : (
                                            <>
                                                REGISTRAR CLIENTE AHORA
                                                <ArrowRight className="h-6 w-6" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        )
                        }
                    </motion.div >
                )}
            </AnimatePresence >

            <div className="text-center text-[10px] font-black text-gray-300 uppercase tracking-[0.5em] pt-10">
                GCO Platform &bull; Secure Data Management &bull; {new Date().getFullYear()}
            </div>
        </div >
    );
}
