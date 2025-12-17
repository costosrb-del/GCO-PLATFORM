"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import axios from "axios";
import {
  Loader2, Search, Filter, RefreshCcw, Calendar,
  TrendingUp, TrendingDown, Download, ChevronLeft,
  ChevronRight, SlidersHorizontal, FileSpreadsheet,
  Building2, MapPin, FileText, Check, ChevronDown
} from "lucide-react";
import * as XLSX from "xlsx";
import { Listbox, Transition } from "@headlessui/react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/config";

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
  const [forceRefresh, setForceRefresh] = useState(false);

  // -- STATE: Filters --
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [selectedMovTypes, setSelectedMovTypes] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  // Available Options (Fetched from Config)
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);

  // Static Helper for Doc Types (So user can select BEFORE fetching)
  const AVAILABLE_DOC_TYPES = ["FV", "FC", "NC", "ND", "CC", "REM"];

  // -- STATE: Client-side Date Filters --
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterSku, setFilterSku] = useState("");

  // -- STATE: Column Filters --
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [activeColFilter, setActiveColFilter] = useState<string | null>(null);

  // -- STATE: Pagination --
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // -- INIT --
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem("gco_token");
        if (!token) return;
        if (!token) return;
        const res = await axios.get(`${API_URL}/config/companies`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data) setAvailableCompanies(res.data);
      } catch (e) {
        console.error("Error fetching companies", e);
      }
    };
    fetchConfig();
  }, []);

  // -- FETCH DATA (CHUNKED) --
  const fetchMovements = async () => {
    const token = localStorage.getItem("gco_token");
    if (!token) {
      alert("No se encontró sesión. Por favor inicia sesión nuevamente.");
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setCurrentPage(1);
    setData([]); // Reset table

    // Helper: Split range into 3-month chunks
    const getChunks = (start: string, end: string) => {
      const chunks = [];
      let curr = new Date(start);
      const final = new Date(end);

      while (curr <= final) {
        let chunkEnd = new Date(curr);
        chunkEnd.setMonth(chunkEnd.getMonth() + 3);
        chunkEnd.setDate(chunkEnd.getDate() - 1);

        if (chunkEnd > final) chunkEnd = final;

        chunks.push({
          start: curr.toISOString().split("T")[0],
          end: chunkEnd.toISOString().split("T")[0]
        });

        // Next chunk starts +1 day
        curr = new Date(chunkEnd);
        curr.setDate(curr.getDate() + 1);
      }
      return chunks;
    }

    const chunks = getChunks(startDate, endDate);
    const totalChunks = chunks.length;

    console.log(`Searching in ${totalChunks} chunks...`, chunks);

    // VALIDATION: If no chunks (e.g. Start > End or Invalid Dates)
    if (totalChunks === 0) {
      alert("⚠️ Rango de fechas inválido. Verifica que la fecha 'Desde' sea menor o igual a 'Hasta'.");
      setIsLoading(false);
      return;
    }

    // Warn user if heavy
    if (totalChunks > 2) {
      // notification toast?
    }

    let allData: any[] = [];
    let hasError = false;

    // Process Chunks Sequentially
    for (let i = 0; i < totalChunks; i++) {
      const { start, end } = chunks[i];
      let url = `${API_URL}/movements/?start_date=${start}&end_date=${end}&force_refresh=${forceRefresh}`;

      console.log(`[Chunk ${i + 1}/${totalChunks}] Fetching: ${url}`);

      // Append filters to URL
      if (selectedCompanies.length > 0) {
        selectedCompanies.forEach(c => url += `&companies=${encodeURIComponent(c)}`);
      }
      if (selectedDocTypes.length > 0) {
        selectedDocTypes.forEach(t => url += `&doc_types=${encodeURIComponent(t)}`);
      }

      try {
        // Update Loading status with progress
        // We can't easily update a text state inside the loop unless we use a ref or simplified state, 
        // but isLoading is bool. Maybe specific state?
        // For now, implicit wait. loading=true.

        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 300000
        });

        if (response.data.errors && response.data.errors.length > 0) {
          // Log but don't stop?
          console.warn("Chunk warnings:", response.data.errors);
        }

        if (response.data.data) {
          // progressive rendering: update state immediately?
          // Yes, let's append!
          const newData = response.data.data;
          allData = [...allData, ...newData];
          // Update UI progressively
          setData(prev => [...prev, ...newData]);
        }

      } catch (error: any) {
        console.error(`Error fetching chunk ${start}-${end}:`, error);
        hasError = true;

        if (error.code === 'ECONNABORTED') {
          alert(`⏱️ Timeout en el rango ${start} a ${end}.`);
        } else {
          // Maybe break? Or continue to try getting other chunks?
          // Usually if network is dead, break.
          // If 500, maybe break.
        }
      }
    }

    setIsLoading(false);

    if (hasError && allData.length > 0) {
      alert("⚠️ Ocurrieron errores en algunos rangos, pero se cargaron datos parciales.");
    } else if (hasError && allData.length === 0) {
      alert("❌ Error: No se pudieron cargar datos. Intenta un rango mas pequeño o verifica tu conexión.");
    }
  };

  // -- DERIVED LISTS FOR FILTERS --
  const uniqueWarehouses = useMemo(() => Array.from(new Set(data.map(d => d.warehouse || "Sin Bodega"))).sort(), [data]);
  // Combined list: Static + Data-derived (to allow strict filtering but also show what's there)
  const uniqueDocTypes = useMemo(() => {
    const fromData = new Set(data.map(d => d.doc_type));
    AVAILABLE_DOC_TYPES.forEach(t => fromData.add(t));
    return Array.from(fromData).sort();
  }, [data]);

  // uniqueCompanies is now based on fetched config + data to ensure consistency? 
  // No, let's keep uniqueCompanies derived from data for the FILTER panel (what is currently shown), 
  // but use availableCompanies for the QUERY selection.
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
          item.nit?.toLowerCase().includes(term) ||
          item.observations?.toLowerCase().includes(term) ||
          item.name?.toLowerCase().includes(term)
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
      // If we queried specific companies, data will only contain them naturally.
      // But if we want to filter further (e.g. queried 3, view 1), we can.
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(item.company || "Sin Empresa")) {
        return false;
      }

      // 6. Client-side Date Filter (Aparte del llamado)
      if (filterStartDate && item.date < filterStartDate) return false;
      if (filterEndDate && item.date > filterEndDate) return false;

      // 7. Client-side SKU Filter
      if (filterSku) {
        const itemSku = (item.code || item.product_code || "").toString().toLowerCase();
        if (!itemSku.includes(filterSku.toLowerCase())) return false;
      }

      // 8. Specific Column Filters
      // Keys matching the ones used in headers
      for (const [key, value] of Object.entries(colFilters)) {
        if (!value) continue;
        const term = value.toLowerCase();

        let match = false;

        if (key === "date") match = (item.date || "").toLowerCase().includes(term);
        else if (key === "doc") {
          match = (item.doc_number || "").toLowerCase().includes(term) || (item.doc_type || "").toLowerCase().includes(term);
        }
        else if (key === "client_company") {
          match = (item.client || "").toLowerCase().includes(term) || (item.company || "").toLowerCase().includes(term);
        }
        else if (key === "sku") {
          match = (item.code || item.product_code || "").toString().toLowerCase().includes(term);
        }
        else if (key === "product") {
          match = (item.description || item.name || "").toLowerCase().includes(term);
        }
        else if (key === "warehouse") {
          match = (item.warehouse || "").toLowerCase().includes(term);
        }
        else if (key === "quantity") {
          match = (item.quantity || "0").toString().includes(term);
        }
        else if (key === "total") {
          match = (item.total || "0").toString().includes(term);
        }
        else if (key === "observations") {
          match = (item.observations || "").toLowerCase().includes(term);
        }

        if (!match) return false;
      }

      return true;
    });
  }, [data, searchTerm, selectedWarehouses, selectedDocTypes, selectedMovTypes, selectedCompanies, filterStartDate, filterEndDate, filterSku, colFilters]);

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

    // Prepare data for Excel
    const excelData = filteredData.map(row => ({
      "Fecha": row.date,
      "Documento": row.doc_type,
      "Numero": row.doc_number,
      "Tipo Movimiento": row.type,
      "Empresa": row.company,
      "Tercero": row.client,
      "NIT": row.nit,
      "Bodega": row.warehouse,
      "SKU": row.product_code || row.code,
      "Producto": row.description || row.name,
      "Cantidad": Number(row.quantity),
      "Precio Unitario": Number(row.price), // Ensure numbers
      "Total": Number(row.total), // Ensure numbers
      "Observaciones": row.observations
    }));

    // Create a new workbook and add the worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");

    // Adjust column widths (optional but nice)
    const wscols = [
      { wch: 12 }, // Fecha
      { wch: 10 }, // Documento
      { wch: 15 }, // Numero
      { wch: 15 }, // Tipo
      { wch: 30 }, // Empresa
      { wch: 30 }, // Tercero
      { wch: 15 }, // NIT
      { wch: 20 }, // Bodega
      { wch: 15 }, // SKU
      { wch: 40 }, // Producto
      { wch: 10 }, // Cantidad
      { wch: 15 }, // Precio
      { wch: 15 }, // Total
      { wch: 50 }, // Obs
    ];
    worksheet["!cols"] = wscols;

    // Generate Excel file
    XLSX.writeFile(workbook, `Movimientos_${startDate}_${endDate}.xlsx`);
  };

  // Toggle Selection Helper
  const toggleSelection = (list: string[], setList: (l: string[]) => void, value: string) => {
    if (list.includes(value)) {
      setList(list.filter(v => v !== value));
    } else {
      setList([...list, value]);
    }
  };

  // Helper Component for Headers
  const FilterableHeader = ({ label, colKey, align = "left" }: { label: string, colKey: string, align?: "left" | "right" }) => {
    const isActive = activeColFilter === colKey;
    const hasValue = colFilters[colKey]?.length > 0;

    return (
      <th className={`px-6 py-4 font-bold relative group ${align === "right" ? "text-right" : "text-left"}`}>
        <div className={`flex items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
          <span>{label}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveColFilter(isActive ? null : colKey); }}
            className={`p-1 rounded-full transition-colors ${hasValue ? "bg-green-100 text-green-700" : "text-gray-300 group-hover:text-gray-500 hover:bg-gray-100"}`}
          >
            <Search className="h-3 w-3" />
          </button>
        </div>

        {isActive && (
          <div className="absolute top-10 left-0 z-50 bg-white border border-gray-200 shadow-xl p-2 rounded-lg min-w-[150px] animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              type="text"
              placeholder={`Filtrar ${label}...`}
              className="w-full text-xs p-1.5 border border-gray-300 rounded focus:border-[#183C30] outline-none text-gray-700 font-normal"
              value={colFilters[colKey] || ""}
              onChange={e => setColFilters(prev => ({ ...prev, [colKey]: e.target.value }))}
            />
            <div className="flex justify-between mt-2">
              <button
                onClick={() => setActiveColFilter(null)}
                className="text-[10px] text-gray-500 hover:text-gray-700 px-1"
              >
                Cerrar
              </button>
              <button
                onClick={() => setColFilters(prev => ({ ...prev, [colKey]: "" }))}
                className="text-[10px] text-red-500 hover:text-red-700 px-1"
              >
                Limpiar
              </button>
            </div>
          </div>
        )}
      </th>
    );
  };

  return (
    <div className="space-y-6 pb-20 p-6 max-w-[1600px] mx-auto">

      {/* HEADER & MAIN CONTROLS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[#183C30]">Auditoria de Movimientos</h1>
          <p className="text-gray-500 text-sm">Consulta detallada, filtrado y exportacion de transacciones.</p>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="flex flex-col sm:flex-row items-center bg-gray-50 p-1.5 rounded-xl border border-gray-100 shadow-sm gap-2 sm:gap-0">

            {/* DATE PICKERS */}
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

            {/* COMPANY SELECTOR (QUERY) */}
            <div className="px-2 relative z-20">
              <Listbox value={selectedCompanies} onChange={setSelectedCompanies} multiple>
                <div className="relative">
                  <Listbox.Button className="relative w-48 cursor-pointer rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-gray-200 focus:outline-none focus:ring-1 focus:ring-green-500 sm:text-xs">
                    <span className="block truncate text-gray-600">
                      {selectedCompanies.length === 0 ? "Todas las empresas" : `${selectedCompanies.length} Empresas`}
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </span>
                  </Listbox.Button>
                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <Listbox.Options className="absolute mt-1 max-h-60 w-64 overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-xs z-50">
                      {availableCompanies.length === 0 && <div className="p-2 text-gray-400">Cargando empresas...</div>}
                      {availableCompanies.map((c, idx) => (
                        <Listbox.Option
                          key={idx}
                          className={({ active }) =>
                            `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? "bg-green-50 text-green-900" : "text-gray-900"
                            }`
                          }
                          value={c}
                        >
                          {({ selected }) => (
                            <>
                              <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                                {c}
                              </span>
                              {selected ? (
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#183C30]">
                                  <Check className="h-4 w-4" aria-hidden="true" />
                                </span>
                              ) : null}
                            </>
                          )}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </Transition>
                </div>
              </Listbox>
            </div>


            <button
              onClick={fetchMovements}
              disabled={isLoading}
              className="ml-2 bg-[#183C30] hover:bg-[#122e24] text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 shadow-md"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>Consultar</span>
            </button>
            <div className="flex items-center space-x-2 ml-2 px-2">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={e => setForceRefresh(e.target.checked)}
                className="rounded border-gray-300 text-[#183C30] focus:ring-[#183C30]"
              />
              <span className="text-xs text-gray-500 whitespace-nowrap">Recargar</span>
            </div>
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
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-green-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm font-medium transition-all whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">Exportar Excel</span>
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

      {/* FILTER PANEL EXTRA: Client Side Dates */}
      {showFilters && (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-2 mb-4 animate-in fade-in slide-in-from-top-1">
          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Filtrar resultados (Local)</p>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Desde:</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-green-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Hasta:</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-green-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">SKU:</span>
              <input
                type="text"
                value={filterSku}
                onChange={e => setFilterSku(e.target.value)}
                placeholder="Ej: 3005..."
                className="border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-green-500 w-24"
              />
            </div>
            {(filterStartDate || filterEndDate || filterSku) && (
              <button onClick={() => { setFilterStartDate(""); setFilterEndDate(""); setFilterSku(""); }} className="text-xs text-red-500 hover:underline">
                Limpiar Filtros
              </button>
            )}
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
                <FilterableHeader label="Fecha" colKey="date" />
                <FilterableHeader label="Documento" colKey="doc" />
                <FilterableHeader label="Tercero / Empresa" colKey="client_company" />
                <FilterableHeader label="SKU" colKey="sku" />
                <FilterableHeader label="Producto" colKey="product" />
                <FilterableHeader label="Bodega" colKey="warehouse" />
                <FilterableHeader label="Cantidad" colKey="quantity" align="right" />
                <FilterableHeader label="Total" colKey="total" align="right" />
                <FilterableHeader label="Observacion" colKey="observations" />
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

                  {/* SKU */}
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{item.code || item.product_code}</span>
                  </td>

                  {/* Product */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col max-w-[200px]">
                      <span className="text-gray-700 font-medium truncate text-xs" title={item.description || item.name}>{item.description || item.name}</span>
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

                  {/* Observation */}
                  <td className="px-6 py-4">
                    <div className="max-w-[150px] truncate text-xs text-gray-400 italic" title={item.observations}>
                      {item.observations || "-"}
                    </div>
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
