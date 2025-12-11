"use client";

import { useState, Fragment } from "react";
import axios from "axios";
import { Loader2, Search, Filter, RefreshCcw, Download, FileSpreadsheet, FileText, Check, ChevronDown } from "lucide-react";
import { Listbox, Transition } from "@headlessui/react";
import { clsx } from "clsx";

// Types
interface InventoryItem {
  company_name: string;
  code: string;
  name: string;
  warehouse_name: string;
  quantity: number;
}

export default function SaldosPage() {
  const [data, setData] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  // Filters State
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [stockStatus, setStockStatus] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");

  const [filterSales, setFilterSales] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);

  const salesCodes = ["7007", "7008", "7009", "7957", "7901", "7101", "7210", "3005", "3001", "7416", "EVO-7701", "EVO-7702", "EVO-7703", "3012", "7299"];

  // View State
  const [viewMode, setViewMode] = useState<"detail" | "consolidated">("detail");

  // Derived Lists
  const companiesList = Array.from(new Set(data.map(item => item.company_name))).sort();
  const warehousesList = Array.from(new Set(data.map(item => item.warehouse_name))).sort();

  const fetchData = async () => {
    setIsLoading(true);
    const token = localStorage.getItem("gco_token");
    if (!token) {
      alert("Sesión no válida. Por favor, reingresa.");
      return;
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await axios.get(`${baseUrl}/inventory/`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000 // 60s timeout
      });
      if (response.data.errors && response.data.errors.length > 0) {
        alert("⚠️ Atencion:\n" + response.data.errors.join("\n"));
      }


      if (response.data.data) {
        setData(response.data.data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (error: any) {
      console.error("Error updating inventory:", error);
      if (error.code === 'ECONNABORTED') {
        alert("⏱️ Tiempo agotado. El servidor no respondió en 60s.");
      }
      else if (error.message === "Network Error" || !error.response) {
        alert("⚠️ Error de Conexión\n\nNo se pudo conectar con el Backend.\n\nPOSIBLE CAUSA: Estás usando la versión en Firebase (HTTPS) pero tu servidor es Local (HTTP). El navegador bloquea esto por seguridad.\n\nSOLUCIÓN: Ejecuta el frontend localmente ('npm run dev') o permite contenido inseguro en la barra de direcciones.");
      } else {
        alert("Error cargando inventario: " + (error.response?.data?.detail || error.message));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (type: "excel" | "pdf") => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      // If in consolidated mode, we might want to export consolidated data, 
      // but backend export logic is likely shared. For now, sending filteredData.
      const response = await axios.post(`${baseUrl}/export/${type}`, filteredData, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `inventario.${type === "excel" ? "xlsx" : "pdf"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Export error", e);
      alert("Error al exportar. Asegurese de que el backend esta corriendo.");
    }
  };

  const filteredData = data.filter(item => {
    if (filterSales) {
      if (!salesCodes.includes(item.code)) return false;
    }
    if (selectedCompanies.length > 0 && !selectedCompanies.includes(item.company_name)) return false;
    if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(item.warehouse_name)) return false;

    if (stockStatus === "Con Stock (>0)" && item.quantity <= 0) return false;
    if (stockStatus === "Sin Stock (0)" && item.quantity !== 0) return false;



    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(lowerTerm) ||
        item.code.toLowerCase().includes(lowerTerm)
      );
    }
    return true;
  });

  // Consolidated Data Logic
  const consolidatedData = Object.values(filteredData.reduce((acc, item) => {
    if (!acc[item.code]) {
      acc[item.code] = {
        code: item.code,
        name: item.name,
        quantity: 0,
        companies: new Set<string>(),
        warehouses: new Set<string>()
      };
    }
    acc[item.code].quantity += item.quantity;
    acc[item.code].companies.add(item.company_name);
    acc[item.code].warehouses.add(item.warehouse_name);
    return acc;
  }, {} as Record<string, { code: string, name: string, quantity: number, companies: Set<string>, warehouses: Set<string> }>))
    .sort((a, b) => b.quantity - a.quantity);

  const totalUnits = filteredData.reduce((acc, item) => acc + item.quantity, 0);
  const activeProducts = new Set(filteredData.filter(i => i.quantity > 0).map(i => i.code)).size;
  const filteredCount = filteredData.length;

  return (
    <div className="space-y-6 pb-20 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[#183C30]">Saldos {viewMode === 'consolidated' ? 'Consolidados' : 'Detallados'}</h1>
          <p className="text-gray-500 text-sm">
            {viewMode === 'consolidated'
              ? 'Vista global de productos unificada por SKU.'
              : 'Inventario detallado por empresa y bodega.'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {lastUpdated && <span className="text-xs text-gray-400 mr-2">Act: {lastUpdated}</span>}

          {/* View Toggle */}
          <div className="bg-gray-100 p-1 rounded-xl flex items-center mr-2">
            <button
              onClick={() => setViewMode("detail")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === "detail" ? "bg-white text-[#183C30] shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Detallado
            </button>
            <button
              onClick={() => setViewMode("consolidated")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === "consolidated" ? "bg-white text-[#183C30] shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Consolidado
            </button>
          </div>

          <button
            onClick={() => handleExport("excel")}
            className="p-2.5 text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-colors border border-green-200"
            title="Exportar Excel"
          >
            <FileSpreadsheet className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="p-2.5 text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-200"
            title="Exportar PDF"
          >
            <FileText className="h-5 w-5" />
          </button>

          <div className="w-px h-8 bg-gray-200 mx-2"></div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className={`flex items-center space-x-2 bg-[#183C30] hover:bg-[#122e24] text-white px-6 py-2.5 rounded-xl transition-all font-medium ${isLoading ? "opacity-90" : "shadow-lg shadow-green-900/20"}`}
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Sincronizando..." : "Actualizar"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Total Unidades" value={totalUnits.toLocaleString()} />
        <KpiCard title="Productos Activos" value={activeProducts.toString()} />
        <KpiCard title="Registros" value={viewMode === 'consolidated' ? consolidatedData.length.toString() : filteredCount.toString()} />
        <KpiCard title="Bodegas" value={warehousesList.length.toString()} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
        <div
          className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50/50"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
        >
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-[#183C30]" />
            <h3 className="font-semibold text-gray-800">Filtros Avanzados</h3>
          </div>
          <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isFiltersOpen ? "rotate-180" : ""}`} />
        </div>

        {isFiltersOpen && (
          <div className="px-6 pb-6 pt-0 space-y-6 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase">Empresas ({selectedCompanies.length})</label>
                <ListBoxMulti
                  options={companiesList}
                  selected={selectedCompanies}
                  onChange={setSelectedCompanies}
                  placeholder="Todas las empresas"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase">Bodegas ({selectedWarehouses.length})</label>
                <ListBoxMulti
                  options={warehousesList}
                  selected={selectedWarehouses}
                  onChange={setSelectedWarehouses}
                  placeholder="Todas las bodegas"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Estado Stock</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#183C30]/20"
                    value={stockStatus}
                    onChange={(e) => setStockStatus(e.target.value)}
                  >
                    <option>Todos</option>
                    <option>Con Stock ({">"}0)</option>
                    <option>Sin Stock (0)</option>
                  </select>
                </div>

                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-200 cursor-pointer" onClick={() => setFilterSales(!filterSales)}>
                    <span className="text-sm font-medium text-gray-700 select-none">Solo Productos de Venta</span>
                    <div
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${filterSales ? "bg-[#183C30]" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition transition-transform ${filterSales ? "translate-x-4" : "translate-x-1"}`} />
                    </div>
                  </div>
                  {filterSales && (
                    <p className="text-[10px] text-gray-400 break-words leading-tight bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold">Codigos filtrados:</span> {salesCodes.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por SKU (7001...) o Nombre..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#183C30]/20 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm text-left relative">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 backdrop-blur sticky top-0 z-10">
              <tr>
                {viewMode === "detail" ? (
                  <>
                    <th className="px-6 py-4 font-medium">Empresa</th>
                    <th className="px-6 py-4 font-medium">SKU</th>
                    <th className="px-6 py-4 font-medium">Producto</th>
                    <th className="px-6 py-4 font-medium">Bodega</th>
                    <th className="px-6 py-4 font-medium text-right">Cantidad</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 font-medium">SKU</th>
                    <th className="px-6 py-4 font-medium">Producto</th>
                    <th className="px-6 py-4 font-medium">Resumen Empresas</th>
                    <th className="px-6 py-4 font-medium text-right">Total Global</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {viewMode === "detail" ? (
                filteredData.length > 0 ? (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-green-50/30 transition-colors group">
                      <td className="px-6 py-3 font-medium text-[#183C30] text-xs">{item.company_name}</td>
                      <td className="px-6 py-3 font-mono text-gray-500 group-hover:text-gray-900">{item.code}</td>
                      <td className="px-6 py-3 text-gray-800 font-medium">{item.name}</td>
                      <td className="px-6 py-3 text-gray-500 text-xs uppercase tracking-wide">{item.warehouse_name}</td>
                      <td className={`px-6 py-3 text-right font-bold ${item.quantity > 0 ? "text-green-600 bg-green-50/50 rounded-lg" : "text-gray-300"}`}>
                        {item.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-6 py-20 text-center text-gray-400">Sin datos</td></tr>
                )
              ) : (
                consolidatedData.length > 0 ? (
                  consolidatedData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-3 font-mono text-gray-500 font-bold group-hover:text-gray-900">{item.code}</td>
                      <td className="px-6 py-3 text-gray-800 font-medium">{item.name}</td>
                      <td className="px-6 py-3 text-xs text-gray-500">
                        {Array.from(item.companies).join(", ")}
                      </td>
                      <td className={`px-6 py-3 text-right font-bold text-lg ${item.quantity > 0 ? "text-blue-700" : "text-gray-400"}`}>
                        {item.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-6 py-20 text-center text-gray-400">Sin datos consolidados</td></tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value }: { title: string, value: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">{title}</p>
      <p className="text-3xl font-bold text-[#183C30] tracking-tight">{value}</p>
    </div>
  );
}

function ListBoxMulti({ options, selected, onChange, placeholder }: any) {
  return (
    <div className="relative">
      <Listbox value={selected} onChange={onChange} multiple>
        <div className="relative mt-1">
          <Listbox.Button className="relative w-full cursor-pointer rounded-xl bg-white py-2.5 pl-3 pr-10 text-left border border-gray-200 focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm h-10 overflow-hidden">
            <span className="block truncate text-gray-700">
              {selected.length === 0 ? <span className="text-gray-400">{placeholder}</span> : selected.join(", ")}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm z-50">
              {options.map((option: string, personIdx: number) => (
                <Listbox.Option
                  key={personIdx}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? "bg-green-50 text-green-900" : "text-gray-900"
                    }`
                  }
                  value={option}
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                        {option}
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
  )
}

