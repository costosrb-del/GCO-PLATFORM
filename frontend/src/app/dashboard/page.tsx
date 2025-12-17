
"use client";

import { useMemo, useState, useEffect } from "react";
import { Loader2, Lock } from "lucide-react";
import { SalesTrendChart } from "@/components/dashboard/SalesTrendChart";
import { TopProductsChart } from "@/components/dashboard/TopProductsChart";
import { YoYChart } from "@/components/dashboard/YoYChart";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useMovements } from "@/hooks/useMovements";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";

export default function DashboardHome() {
  // 1. Auto Sync on Mount
  useAutoSync();

  // Role State
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    // Get role from storage
    const stored = localStorage.getItem("gco_role");
    setRole(stored);
  }, []);

  // 2. Local State (UI Filters)
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 30); // Default view: 30 days
    return {
      start: start.toISOString().split("T")[0],
      end: today.toISOString().split("T")[0],
    };
  });
  const [searchRef, setSearchRef] = useState("");

  // 3. Central Data Fetching (Fetch Range = Full History 2020 - Present)
  const fetchRange = useMemo(() => {
    // Always fetch from 2020 Jan 1st to ensure we have ALL data for deep analysis
    const currentYear = new Date().getFullYear();

    return {
      start: `2020-01-01`,
      end: `${currentYear}-12-31`
    };
  }, []); // Stable fetch range.

  // Only refetch if the YEAR changes (stable here).
  const { data: rawData, isLoading, isError } = useMovements(fetchRange.start, fetchRange.end);

  // 4. Client-Side Filtering
  // Filter the RAW huge dataset based on the UI `dateRange`.
  const filteredData = useMemo(() => {
    if (!rawData?.data) return [];

    return rawData.data.filter(m => {
      // Date within range?
      if (m.date < dateRange.start || m.date > dateRange.end) return false;
      return true;
    });
  }, [rawData, dateRange]);

  // Determine Active Year for YoY Comparison based on Filter
  const activeYear = dateRange.end ? new Date(dateRange.end).getFullYear() : new Date().getFullYear();

  return (
    <div className="p-8 space-y-6">

      {/* Loading Indicator (Minimal, Top Right) */}
      {isLoading && !rawData && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 text-xs text-blue-600 bg-white shadow-lg border border-blue-100 px-3 py-1 rounded-full">
          <Loader2 className="h-3 w-3 animate-spin" />
          Sincronizando datos...
        </div>
      )}

      {/* Global Filters */}
      <DashboardFilters
        dateRange={dateRange}
        setDateRange={setDateRange}
        searchRef={searchRef}
        setSearchRef={setSearchRef}
      />

      {/* Access Control Check */}
      {role === "viewer" ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-center">
          <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Vista Restringida</h3>
          <p className="text-sm text-gray-500 max-w-sm mt-1">
            Su usuario tiene permisos de <strong>Visualizador</strong>.
            No tiene acceso a los análisis de ventas financieros.
          </p>
        </div>
      ) : (
        <>
          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="col-span-1 lg:col-span-3">
              <SalesTrendChart
                data={filteredData} // Passing filtered data
                isLoading={isLoading && !rawData}
                isError={isError}
                searchRef={searchRef}
              />
            </div>
            <div className="col-span-1 lg:col-span-1">
              <TopProductsChart
                data={filteredData} // Passing filtered data
                isLoading={isLoading && !rawData}
                isError={isError}
              />
            </div>
          </div>

          {/* YoY Comparison Section */}
          <YoYChart
            data={rawData?.data || []} // Low-Level Component handles Year Filtering
            isLoading={isLoading && !rawData}
            targetYear={activeYear} // Dynamic Year from Filters
          />
        </>
      )}
    </div>
  );
}
