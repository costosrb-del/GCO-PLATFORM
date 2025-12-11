"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Loader2, Search, Filter, RefreshCcw, Calendar,
  TrendingUp, TrendingDown, Download, ChevronLeft,
  ChevronRight, SlidersHorizontal, FileSpreadsheet,
  Building2, MapPin, FileText
} from "lucide-react";
import { useRouter } from "next/navigation";

// Utility for formatting currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function MovementsPage() {
  const router = useRouter();

  // -- STATE: API & Data --
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // -- STATE: Filters --
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [selectedMovTypes, setSelectedMovTypes] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  // -- STATE: Pagination --
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // -- FETCH DATA --
  const fetchMovements = async () => {
    const token = localStorage.getItem("gco_token");
    if (!token) {
      alert("No se encontró sesión. Por favor inicia sesión nuevamente.");
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setCurrentPage(1); // Reset to first page on new search

    try {
      // Determine API URL (Hardcoded or Env Var)
      // For now, if running locally use localhost, else assuming relative path or env
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      let url = `${baseUrl}/movements/?start_date=${startDate}&end_date=${endDate}`;

      // If we had company selection before fetch, we'd add it here:
      // selectedCompanies.forEach(c => url += `&companies=${encodeURIComponent(c)}`);

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.data) {
        setData(response.data.data);
      } else {
        setData([]);
      }
    } catch (error: any) {
      console.error("Error fetching movements:", error);
      if (error.response && error.response.status === 401) {
        // router.push("/"); // Temporarily disabled to debug "me saca" issue
        alert("Session expired or invalid token. Please log in again.");
      } else {
        alert("Error fetching data: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // -- DERIVED LISTS FOR FILTERS --
  const uniqueWarehouses = useMemo(() => Array.from(new Set(data.map(d => d.warehouse || "Sin Bodega"))).sort(), [data]);
  const uniqueDocTypes = useMemo(() => Array.from(new Set(data.map(d => d.doc_type))).sort(), [data]);
  const uniqueCompanies = useMemo(() => Array.from(new Set(data.map(d => d.company || "Sin Empresa"))).sort(), [data]);

  // -- FILTERING LOGIC --
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 1. Text Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches = (
          item.description?.toLowerCase().includes(term) ||
          item.doc_name?.toLowerCase().includes(term) ||
          item.doc_number?.toLowerCase().includes(term) ||
          item.product_code?.toLowerCase().includes(term) ||
          item.client?.toLowerCase().includes(term) ||
          item.nit?.toLowerCase().includes(term)
        );
        if (!matches) return false;
      }

      // 2. Warehouse Filter
      if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(item.warehouse || "Sin Bodega")) {
        return false;
      }

      // 3. Doc Type Filter
      if (selectedDocTypes.length > 0 && !selectedDocTypes.includes(item.doc_type)) {
        return false;
      }

      // 4. Movement Type Filter
      if (selectedMovTypes.length > 0) {
        // Map item.type (Entrada/Salida) to selection
        const type = item.type?.toUpperCase(); // ENTRADA, SALIDA
        if (!selectedMovTypes.includes(type)) return false;
      }

      // 5. Company Filter (Client-side)
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(item.company || "Sin Empresa")) {
        return false;
      }

      return true;
    });
  }, [data, searchTerm, selectedWarehouses, selectedDocTypes, selectedMovTypes, selectedCompanies]);

  // -- PAGINATION LOGIC --
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // -- KPIs --
  const kpiTotalIn = filteredData.reduce((acc, item) => item.type === "ENTRADA" ? acc + item.quantity : acc, 0);
  const kpiTotalOut = filteredData.reduce((acc, item) => item.type === "SALIDA" ? acc + item.quantity : acc, 0);

  // -- EXPORT FUNCTION --
  const handleExport = () => {
    if (filteredData.length === 0) return;

    // Create CSV content
    const headers = ["Fecha", "Documento", "Numero", "Tipo", "Empresa", "Tercero", "NIT", "Bodega", "Codigo", "Producto", "Cantidad", "Precio", "Total", "Observaciones"];
    const csvRows = [headers.join(",")];

    filteredData.forEach(row => {
      const values = [
        row.date,
        row.doc_type,
        row.doc_number,
        row.type,
        `"${(row.company || "").replace(/"/g, '""')}"`,
        `"${(row.client || "").replace(/"/g, '""')}"`,
        row.nit,
        `"${(row.warehouse || "").replace(/"/g, '""')}"`,
        row.product_code || row.code,
        `"${(row.description || row.name || "").replace(/"/g, '""')}"`,
        row.quantity,
        row.price,
        row.total,
        `"${(row.observations || "").replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + encodeURI(csvRows.join("\n")); // Add BOM for Excel
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `movimientos_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle Selection Helper
  const toggleSelection = (list: string[], setList: (l: string[]) => void, value: string) => {
    if (list.includes(value)) {
      setList(list.filter(v => v !== value));
    } else {
      setList([...list, value]);
    }
  };

  return (
    <div className="space-y-6 pb-20 p-6 max-w-[1600px] mx-auto">

      {/* HEADER & MAIN CONTROLS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[#183C30]">Auditoria de Movimientos</h1>
          <p className="text-gray-500 text-sm">Consulta detallada, filtrado y exportacion de transacciones.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center bg-gray-50 p-1.5 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center px-3 space-x-2 border-r border-gray-200">
              <span className="text-xs font-semibold text-gray-400 uppercase">Desde</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm font-medium outline-none text-gray-700 w-32"
              />
            </div>
            <div className="flex items-center px-3 space-x-2 border-r border-gray-200">
              <span className="text-xs font-semibold text-gray-400 uppercase">Hasta</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm font-medium outline-none text-gray-700 w-32"
              />
            </div>
            <button
              onClick={fetchMovements}
              disabled={isLoading}
              className="ml-2 bg-[#183C30] hover:bg-[#122e24] text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 shadow-md"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>Consultar</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-xl border flex items-center space-x-2 text-sm font-medium transition-all ${showFilters ? 'bg-[#183C30] text-white border-[#183C30]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filtros</span>
            </button>
            <button
              onClick={handleExport}
              disabled={data.length === 0}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-green-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm font-medium transition-all"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          </div>
        </div>
      </div>


      {/* ADVANCED FILTERS PANEL - Always Visible if button clicked */}
      {showFilters && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* Warehouse Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Bodegas
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2 space-y-1 bg-gray-50/50">
                {uniqueWarehouses.map(w => (
                  <label key={w} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedWarehouses.includes(w)}
                      onChange={() => toggleSelection(selectedWarehouses, setSelectedWarehouses, w)}
                      className="rounded text-[#183C30] focus:ring-[#183C30]"
                    />
                    <span className="truncate">{w}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Doc Type Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                <FileText className="h-3 w-3" /> Tipo Documento
              </label>
              <div className="flex flex-wrap gap-2">
                {uniqueDocTypes.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleSelection(selectedDocTypes, setSelectedDocTypes, t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedDocTypes.includes(t)
                      ? 'bg-[#183C30] text-white border-[#183C30]'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Movement Type Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                <StepIcon className="h-3 w-3" /> Movimiento
              </label>
              <div className="flex gap-2">
                {['ENTRADA', 'SALIDA'].map(type => (
                  <button
                    key={type}
                    onClick={() => toggleSelection(selectedMovTypes, setSelectedMovTypes, type)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${selectedMovTypes.includes(type)
                      ? (type === 'ENTRADA' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200')
                      : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'
                      }`}
                  >
                    {type === 'ENTRADA' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Company Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Empresa
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2 space-y-1 bg-gray-50/50">
                {uniqueCompanies.map(c => (
                  <label key={c} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedCompanies.includes(c)}
                      onChange={() => toggleSelection(selectedCompanies, setSelectedCompanies, c)}
                      className="rounded text-[#183C30] focus:ring-[#183C30]"
                    />
                    <span className="truncate">{c}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* KPI BANNERS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Registros Filtrados</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{filteredData.length}</p>
          </div>
          <div className="h-10 w-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
            <Filter className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-2xl border border-green-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-green-600/70 uppercase font-bold tracking-wider">Total Entradas</p>
            <p className="text-3xl font-bold text-green-700 mt-1">+{kpiTotalIn.toLocaleString()}</p>
          </div>
          <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-white p-5 rounded-2xl border border-red-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-red-600/70 uppercase font-bold tracking-wider">Total Salidas</p>
            <p className="text-3xl font-bold text-red-700 mt-1">-{kpiTotalOut.toLocaleString()}</p>
          </div>
          <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">

        {/* Search Bar in Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por producto, codigo, cliente, documento..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#183C30]/20 focus:border-[#183C30] outline-none transition-all"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {/* Pagination Controls (Top) */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Mostrando {paginatedData.length} de {filteredData.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-bold">Fecha</th>
                <th className="px-6 py-4 font-bold">Documento</th>
                <th className="px-6 py-4 font-bold">Tercero / Empresa</th>
                <th className="px-6 py-4 font-bold">Producto</th>
                <th className="px-6 py-4 font-bold">Bodega</th>
                <th className="px-6 py-4 font-bold text-right">Cantidad</th>
                <th className="px-6 py-4 font-bold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedData.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/80 transition-colors group">
                  {/* Date */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-gray-600 text-xs">{item.date}</span>
                  </td>

                  {/* Document */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${item.type === 'ENTRADA'
                          ? 'bg-green-50 text-green-600 border-green-100'
                          : 'bg-red-50 text-red-600 border-red-100'
                          }`}>
                          {item.doc_type}
                        </span>
                        <span className="font-medium text-gray-900">{item.doc_number}</span>
                      </div>
                    </div>
                  </td>

                  {/* Client / Company */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col max-w-[200px]">
                      <span className="text-gray-900 font-medium truncate text-xs" title={item.client}>{item.client}</span>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{item.company}</span>
                      </div>
                    </div>
                  </td>

                  {/* Product */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col max-w-[250px]">
                      <span className="text-gray-700 font-medium truncate" title={item.description || item.name}>{item.description || item.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono bg-gray-50 w-fit px-1 rounded mt-1">{item.product_code || item.code}</span>
                    </div>
                  </td>

                  {/* Warehouse */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1 text-gray-500 text-xs">
                      <MapPin className="h-3 w-3 opacity-50" />
                      <span className="truncate max-w-[120px]" title={item.warehouse}>{item.warehouse}</span>
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className={`px-6 py-4 text-right font-bold ${item.type === "ENTRADA" ? "text-green-600" : "text-red-600"}`}>
                    {item.type === "ENTRADA" ? "+" : "-"}{Math.abs(item.quantity).toLocaleString()}
                  </td>

                  {/* Total Price */}
                  <td className="px-6 py-4 text-right text-gray-600 font-mono text-xs">
                    {formatCurrency(item.total || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <select
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#183C30]"
            >
              <option value={20}>20 filas</option>
              <option value={50}>50 filas</option>
              <option value={100}>100 filas</option>
            </select>
            <span className="text-xs text-gray-400">por pagina</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-gray-600">
              Pagina {currentPage} de {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>


      {/* EMPTY STATES */}
      {!hasSearched && !isLoading && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
          <Calendar className="h-16 w-16 mb-6 opacity-10" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Comienza tu auditoria</h3>
          <p className="max-w-md text-center text-gray-400">Selecciona un rango de fechas en la parte superior y haz clic en "Consultar" para ver los movimientos de todas tus empresas.</p>
        </div>
      )}

      {hasSearched && !isLoading && data.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <RefreshCcw className="h-10 w-10 mb-4 opacity-20" />
          <p>No se encontraron movimientos en este rango de fechas.</p>
        </div>
      )}
    </div>
  );
}

// Icon helper
function StepIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
