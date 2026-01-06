"use client";

import { useState, Fragment, useEffect, useMemo } from "react";
import axios from "axios";
import { Loader2, Search, Filter, RefreshCcw, Download, FileSpreadsheet, FileText, Check, ChevronDown, TrendingUp, ArrowUpDown, MessageCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { Listbox, Transition } from "@headlessui/react";
import { clsx } from "clsx";
import { API_URL } from "@/lib/config";

import { useInventory, useSalesAverages, useRefreshSalesAverages } from "@/hooks/useInventory";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Types
interface InventoryItem {
  company_name: string;
  code: string;
  name: string;
  warehouse_name: string;
  quantity: number;
}

interface SalesAverage {
  sku: string;
  average: number;
}

interface ConsolidatedItem {
  code: string;
  name: string;
  quantity: number;
  companies: Set<string>;
  warehouses: Set<string>;
  dailyAverage: number;
  daysSupply: number;
}

export default function SaldosPage() {
  const [data, setData] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Averages State

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("");
  const [role, setRole] = useState("viewer");

  // Filters State
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [stockStatus, setStockStatus] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");

  const [filterSales, setFilterSales] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);

  const salesCodes = ["7007", "7008", "7009", "7957", "7901", "7101", "7210", "3005", "3001", "7416", "EVO-7701", "EVO-7702", "EVO-7703", "3012", "7299"];

  // View State
  const [viewMode, setViewMode] = useState<"detail" | "consolidated">("detail");

  // Derived Lists
  const companiesList = Array.from(new Set(data.map(item => item.company_name))).sort();
  const warehousesList = Array.from(new Set(data.map(item => item.warehouse_name))).sort();

  useEffect(() => {
    // 1. Get Role
    const userRole = localStorage.getItem("gco_role") || "viewer";
    setRole(userRole);

    // 2. Apply Constraints for Viewer
    if (userRole === "viewer") {
      setFilterSales(true);
      setViewMode("consolidated");
    }

    // 3. Try to load cached data from session (Persistence across tabs)
    try {
      const cached = sessionStorage.getItem("gco_inventory_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        setData(parsed.data);
        setLastUpdated(parsed.lastUpdated);
      }
    } catch (e) {
      console.error("Failed to load session cache", e);
    }

    // 4. Load Filters from LocalStorage
    const savedCompanies = localStorage.getItem("gco_filters_companies_v2");
    const savedWarehouses = localStorage.getItem("gco_filters_warehouses_v2");
    if (savedCompanies) setSelectedCompanies(JSON.parse(savedCompanies));
    if (savedWarehouses) setSelectedWarehouses(JSON.parse(savedWarehouses));

  }, []);

  // Persist filters
  useEffect(() => {
    localStorage.setItem("gco_filters_companies_v2", JSON.stringify(selectedCompanies));
  }, [selectedCompanies]);

  useEffect(() => {
    localStorage.setItem("gco_filters_warehouses_v2", JSON.stringify(selectedWarehouses));
  }, [selectedWarehouses]);

  const { data: averagesData, isFetching: isAveragesFetching } = useSalesAverages(true);
  const { mutate: refreshAverages, isPending: isRefreshingAverages } = useRefreshSalesAverages();
  const { data: inventoryData, isLoading: isInventoryLoading, error: inventoryError } = useInventory();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (inventoryData) {
      setData(inventoryData);
      const nowIdx = new Date().toLocaleTimeString();
      setLastUpdated(nowIdx);

      // Smart Defaults (Only on first load if no user preference)
      const savedWarehouses = localStorage.getItem("gco_filters_warehouses_v2");
      if (!savedWarehouses && inventoryData.length > 0) {
        // User has no preference, apply requested defaults
        // Find exact warehouse names matching "rionegro" and "libre"
        const allWarehouses = Array.from(new Set(inventoryData.map((i: any) => i.warehouse_name)));
        const defaults = allWarehouses.filter((wh: unknown) => {
          const w = String(wh).toLowerCase();
          return w.includes("rionegro") || w.includes("libre");
        });

        if (defaults.length > 0) {
          setSelectedWarehouses(defaults as string[]);
        }
      }

      // Update Persistent Cache
      try {
        sessionStorage.setItem("gco_inventory_cache", JSON.stringify({
          data: inventoryData,
          lastUpdated: nowIdx
        }));
      } catch (e) {
        console.error("Cache save failed", e);
      }
    }
  }, [inventoryData]);

  // Keep manual refresh with Stream for progress feedback
  const handleManualRefresh = async () => {
    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage("Iniciando...");

    const token = localStorage.getItem("gco_token");
    if (!token) {
      toast.error("Sesión no válida. Por favor, reingresa.");
      setIsLoading(false);
      return;
    }

    try {
      const baseUrl = API_URL;
      const response = await fetch(`${baseUrl}/inventory/stream?force_refresh=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server Error (${response.status}): ${errText}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.replace("data: ", "");
            try {
              const eventData = JSON.parse(jsonStr);

              if (eventData.progress !== undefined) {
                setLoadingProgress(eventData.progress);
                setLoadingMessage(eventData.message);
              }

              if (eventData.complete_data) {
                const finalData = eventData.complete_data;
                if (finalData.errors && finalData.errors.length > 0) {
                  toast.warning("⚠️ Atencion:\n" + finalData.errors.join("\n"));
                }
                if (finalData.data) {
                  // Update Local State
                  setData(finalData.data);
                  const nowIdx = new Date().toLocaleTimeString();
                  setLastUpdated(nowIdx);

                  // Update React Query Cache
                  queryClient.setQueryData(['inventory'], finalData.data);

                  // Update Session Cache (Fix for F5 reverting to old data)
                  sessionStorage.setItem("gco_inventory_cache", JSON.stringify({
                    data: finalData.data,
                    lastUpdated: nowIdx
                  }));
                }
              }
            } catch (e) {
              console.error("Error parsing SSE", e);
            }
          }
        }
      }

    } catch (error: any) {
      console.error("Error updating inventory:", error);
      toast.error("Error cargando inventario: " + error.message);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
      setLoadingProgress(0);
    }
  };



  const handleShareWhatsApp = () => {
    // 1. Header
    const dateStr = new Date().toLocaleDateString("es-CO", { day: '2-digit', month: '2-digit', year: 'numeric' });
    let message = `📊 *Reporte GCO - ${dateStr}*\n_SKU: Unds (Días Inv)_\n\n`;

    // 2. Body (List)
    // Use consolidatedData if available (has averages), otherwise detailed
    const sourceData = viewMode === 'consolidated' ? consolidatedData : filteredData;

    // Limit to top 30 to avoid URL length limits
    const limit = 30;
    const itemsToShow = sourceData.slice(0, limit);

    // 3. Open WhatsApp
    // Use proper newlines and simplified format
    const lines = itemsToShow.map((item: any) => {
      const code = item.code;
      const qty = Math.floor(item.quantity).toLocaleString();

      let daysStr = "Sin Info";
      if (viewMode === 'consolidated' && item.dailyAverage > 0) {
        daysStr = `${Math.floor(item.daysSupply)}d`;
      } else if (item.quantity === 0) {
        daysStr = "AGOTADO";
      }

      // Format: • 7001: 50unds | Inv: 10d ⚠️
      const alert = (viewMode === 'consolidated' && item.daysSupply < 15 && item.daysSupply > 0) ? " ⚠️" : "";
      return `• *${code}*: ${qty}unds | Inv: ${daysStr}${alert}`;
    });

    let header = `📊 *REPORTE GCO - ${dateStr}*\nSKU | Unds | Días Inv\n`;
    let body = lines.join("\n");
    let footer = `\n_Generado desde GCO Platform_`;

    if (sourceData.length > limit) {
      footer = `\n... y ${sourceData.length - limit} más.` + footer;
    }

    const finalMessage = header + "\n" + body + "\n" + footer;

    // Explicitly use %0A for newlines if encodedURIComponent doesn't behave as expected in some contexts, but standard is encodeURIComponent
    const url = `https://wa.me/?text=${encodeURIComponent(finalMessage)}`;
    window.open(url, '_blank');
  };

  const handleExport = async (type: "excel" | "pdf") => {
    if (type === "excel") {
      // Client-side Excel Export
      if (filteredData.length === 0) return;

      // Map data
      const excelData = filteredData.map(item => ({
        "Empresa": item.company_name,
        "SKU": item.code,
        "Producto": item.name,
        "Bodega": item.warehouse_name,
        "Cantidad": Number(item.quantity)
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Saldos");

      // Columns width
      const wscols = [
        { wch: 30 }, // Empresa
        { wch: 15 }, // SKU
        { wch: 40 }, // Producto
        { wch: 30 }, // Bodega
        { wch: 15 }, // Cantidad
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, `Saldos_${new Date().toISOString().split("T")[0]}.xlsx`);
    } else {
      // Server-side PDF Export
      const exportData = (viewMode === 'consolidated' ? consolidatedData : filteredData).map((item: any) => {
        // ensure conflictDate is calculated matchin UI logic
        let cDate = "-";
        const avg = item.dailyAverage || 0;
        const days = item.daysSupply || 0;

        if (avg > 0 && days < 9999) {
          const d = new Date();
          d.setDate(d.getDate() + Math.floor(days));
          cDate = d.toLocaleDateString("es-CO", { day: '2-digit', month: 'short', year: 'numeric' });
        } else if (item.quantity === 0) {
          cDate = "Agotado";
        }

        return {
          ...item,
          conflictDate: cDate
        };
      });

      if (exportData.length === 0) {
        alert("No hay datos para exportar.");
        return;
      }

      try {
        const token = localStorage.getItem("gco_token");
        const baseUrl = API_URL;

        alert("Generando PDF... por favor espere.");

        const response = await axios.post(`${baseUrl}/inventory/export/pdf`, exportData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Saldos_${new Date().toISOString().split('T')[0]}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();

      } catch (e) {
        console.error("Error generating PDF", e);
        alert("Error generando PDF. Intente nuevamente.");
      }
    }
  };

  const filteredData = useMemo<InventoryItem[]>(() => {
    return data.filter((item: InventoryItem) => {
      if (filterSales) {
        // Exempt 'Inventario Externo' from sales filter code check
        // Robust check for company name
        const isExternal = item.company_name && item.company_name.includes("Inventario Externo");
        if (!isExternal && !salesCodes.includes(item.code)) return false;
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
  }, [data, filterSales, selectedCompanies, selectedWarehouses, stockStatus, searchTerm]);

  // Consolidated Data Logic
  const consolidatedData = useMemo<ConsolidatedItem[]>(() => {
    let consolidated = Object.values(filteredData.reduce((acc: Record<string, ConsolidatedItem>, item: InventoryItem) => {
      if (!acc[item.code]) {
        acc[item.code] = {
          code: item.code,
          name: item.name,
          quantity: 0,
          companies: new Set<string>(),
          warehouses: new Set<string>(),
          dailyAverage: 0,
          daysSupply: 0
        };
      }
      acc[item.code].quantity += item.quantity;
      acc[item.code].companies.add(item.company_name);
      acc[item.code].warehouses.add(item.warehouse_name);
      return acc;
    }, {} as Record<string, ConsolidatedItem>));

    // Enrich with averages
    consolidated = consolidated.map((item: ConsolidatedItem) => {
      const avg = averagesData?.averages?.[item.code] || 0;
      let days = 0;
      if (avg > 0) {
        days = item.quantity / avg;
      }
      return { ...item, dailyAverage: avg, daysSupply: days };
    });

    // Sort Consolidated Data
    if (sortConfig !== null && viewMode === 'consolidated') {
      consolidated.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof typeof a];
        let bValue: any = b[sortConfig.key as keyof typeof b];

        if (sortConfig.key === 'daysSupply') {
          // Handle Infinity or missing values
          if (a.dailyAverage === 0 && a.quantity > 0) aValue = Number.POSITIVE_INFINITY;
          if (b.dailyAverage === 0 && b.quantity > 0) bValue = Number.POSITIVE_INFINITY;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by quantity
      consolidated.sort((a, b) => b.quantity - a.quantity);
    }

    return consolidated;
  }, [filteredData, averagesData, sortConfig, viewMode]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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

          {/* New Averages Button */}
          {viewMode === 'consolidated' && (
            <button
              onClick={() => refreshAverages()}
              disabled={isRefreshingAverages}
              className={`flex items-center space-x-2 px-4 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-xl border border-orange-200 transition-all ${isRefreshingAverages ? "opacity-70 cursor-wait" : ""}`}
              title="Calcular promedios de venta 7 días"
            >
              {isRefreshingAverages ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              <span className="text-sm font-medium hidden md:inline">
                {isRefreshingAverages ? "Calculando..." : "Actualizar Promedios (7d)"}
              </span>
            </button>
          )}

          {/* View Toggle */}
          <div className={`bg-gray-100 p-1 rounded-xl flex items-center mr-2 ${role === 'viewer' ? 'hidden' : ''}`}>
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
          {role === 'viewer' && (
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg mr-2">Vista Consolidada</span>
          )}

          <button
            onClick={() => handleExport("excel")}
            className="flex items-center space-x-2 p-2.5 text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-colors border border-green-200"
            title="Exportar Excel"
          >
            <FileSpreadsheet className="h-5 w-5" />
            <span className="hidden xl:inline font-medium text-sm">Exportar Excel</span>
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="p-2.5 text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-200"
            title="Exportar PDF"
          >
            <FileText className="h-5 w-5" />
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="p-2.5 text-[#25D366] bg-green-50 hover:bg-green-100 rounded-xl transition-colors border border-green-200"
            title="Compartir en WhatsApp"
          >
            <MessageCircle className="h-5 w-5" />
          </button>

          <div className="w-px h-8 bg-gray-200 mx-2"></div>

          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className={`flex items-center space-x-2 bg-[#183C30] hover:bg-[#122e24] text-white px-6 py-2.5 rounded-xl transition-all font-medium ${isLoading ? "opacity-90 w-48 justify-center" : "shadow-lg shadow-green-900/20"}`}
          >
            {isLoading ? (
              <div className="flex flex-col items-center w-full">
                <span className="text-xs mb-1">{loadingMessage} {loadingProgress}%</span>
                <div className="w-full bg-green-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-green-400 h-full transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
                </div>
              </div>
            ) : (
              <>
                <RefreshCcw className="h-4 w-4" />
                <span>Actualizar</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Total Unidades" value={totalUnits.toLocaleString()} />
        <KpiCard title="Productos Activos" value={activeProducts.toString()} />
        <KpiCard title="Registros" value={viewMode === 'consolidated' ? consolidatedData.length.toString() : filteredCount.toString()} />
        <KpiCard title="Bodegas" value={warehousesList.length.toString()} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm relative z-20 transition-all">
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

              {role !== 'viewer' && (
                <>
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
                </>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Estado Stock</label>
                  <select
                    className={`w-full border border-gray-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#183C30]/20 ${role === 'viewer' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                    value={stockStatus}
                    onChange={(e) => setStockStatus(e.target.value)}
                    disabled={role === 'viewer'}
                  >
                    <option>Todos</option>
                    <option>Con Stock ({">"}0)</option>
                    <option>Sin Stock (0)</option>
                  </select>
                </div>

                <div className="flex flex-col space-y-2">
                  <div
                    className={`flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-200 ${role === 'viewer' ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => {
                      if (role !== 'viewer') {
                        const newFilterState = !filterSales;
                        setFilterSales(newFilterState);
                        if (newFilterState) {
                          // Auto-select warehouses - Robust Match from available list
                          const targetWarehouses = warehousesList.filter(wh => {
                            const w = wh.toLowerCase();
                            return (w.includes("principal") && w.includes("rionegro")) || w.includes("bodega libre") || w.includes("sin ingresar") || w.includes("sin asignar") || w.includes("externa");
                          });
                          if (targetWarehouses.length > 0) {
                            setSelectedWarehouses(targetWarehouses);
                          }
                        }
                      }
                    }}
                  >
                    <span className="text-sm font-medium text-gray-700 select-none">
                      Solo Productos de Venta {role === 'viewer' && "(Bloqueado)"}
                    </span>
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

      {isInventoryLoading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 mb-6">
          <div className="flex space-x-4 mb-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-8 w-1/4" />
          </div>
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${isInventoryLoading ? 'hidden' : ''}`}>
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
                    {/* <th className="px-6 py-4 font-medium">Resumen Empresas</th> Removed */}
                    {/* Always visible columns for averages */}
                    <th className="px-6 py-4 font-medium text-center">Promedio (7d)</th>
                    <th
                      className="px-6 py-4 font-medium text-center cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('daysSupply')}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Dias Inv.</span>
                        <ArrowUpDown className="h-3 w-3 text-gray-400 group-hover:text-gray-700" />
                      </div>
                    </th>
                    <th className="px-6 py-4 font-medium text-center">Fecha Agotado</th>

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
                  consolidatedData.map((item) => {
                    // Calculate Stockout Date
                    let conflictDate = "-";
                    // Only calculate date if we have valid averages
                    const isValidAverage = item.dailyAverage > 0;
                    if (isValidAverage && item.daysSupply < 9999) {
                      const days = Math.floor(item.daysSupply);
                      const date = new Date();
                      date.setDate(date.getDate() + days);
                      conflictDate = date.toLocaleDateString("es-CO", { day: '2-digit', month: 'short', year: 'numeric' });
                    } else if (item.quantity === 0) {
                      conflictDate = "Agotado";
                    }

                    return (
                      <tr key={item.code} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-3 font-mono text-gray-500 font-bold group-hover:text-gray-900">{item.code}</td>
                        <td className="px-6 py-3 text-gray-800 font-medium">{item.name}</td>
                        {/* <td className="px-6 py-3 text-xs text-gray-500">
                        {Array.from(item.companies).join(", ")}
                      </td> Removed */}
                        {/* Always visible cells for averages */}
                        <td className="px-6 py-3 text-center text-gray-600">
                          {isAveragesFetching && !item.dailyAverage ? (
                            <span className="text-gray-400 text-xs animate-pulse">Calc...</span>
                          ) : (
                            item.dailyAverage > 0 ? item.dailyAverage.toFixed(2) : "-"
                          )}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {isAveragesFetching && !item.dailyAverage ? (
                            <span className="text-gray-400 text-xs animate-pulse">...</span>
                          ) : (
                            item.dailyAverage > 0 ? (
                              <div className="flex flex-col items-center">
                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${item.daysSupply < 15 ? "bg-red-100 text-red-700" :
                                  item.daysSupply < 45 ? "bg-yellow-100 text-yellow-800" :
                                    "bg-green-100 text-green-700"
                                  }`}>
                                  {item.daysSupply.toFixed(1)} días
                                </span>
                                <span className="text-[10px] text-gray-400 mt-1 font-mono">
                                  {item.quantity.toFixed(0)} / {item.dailyAverage.toFixed(1)}
                                </span>
                                <span className="text-[8px] text-gray-300">
                                  {Array.from(item.warehouses).join(", ").substring(0, 20)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs text-center block">-</span>
                            )
                          )}
                        </td>
                        <td className="px-6 py-3 text-center text-xs font-medium text-gray-500">
                          {conflictDate}
                        </td>

                        <td className={`px-6 py-3 text-right font-bold text-lg ${item.quantity > 0 ? "text-blue-700" : "text-gray-400"}`}>
                          {item.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400">Sin datos consolidados</td></tr>
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
            <Listbox.Options className="absolute mt-1 max-h-96 w-full overflow-auto rounded-xl bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm z-50">
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

