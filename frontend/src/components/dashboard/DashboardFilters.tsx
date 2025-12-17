
"use client";

import { Filter, Calendar as CalendarIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DashboardFiltersProps {
    dateRange: { start: string, end: string };
    setDateRange: (range: { start: string, end: string }) => void;
    searchRef: string;
    setSearchRef: (term: string) => void;
    onForceRefresh: () => void;
}

export function DashboardFilters({ dateRange, setDateRange, searchRef, setSearchRef, onForceRefresh }: DashboardFiltersProps) {
    return (
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            {/* Year/Range Selectors */}
            <div className="flex items-center gap-2 border-r pr-4 border-gray-200">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Filter className="h-4 w-4" /> Filtros Globales
                </span>
                <Button
                    onClick={onForceRefresh}
                    variant="outline"
                    size="sm"
                    className="ml-2 h-8 text-xs bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 hover:text-orange-800"
                >
                    <span className="mr-1">↻</span> Recargar y Corregir
                </Button>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <CalendarIcon className="h-4 w-4 text-gray-500 mr-2" />
                    <input
                        type="date"
                        className="bg-transparent text-sm text-gray-700 focus:outline-none"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    />
                    <span className="mx-2 text-gray-400">-</span>
                    <input
                        type="date"
                        className="bg-transparent text-sm text-gray-700 focus:outline-none"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    />
                </div>

                {/* Quick Filters (Optional) */}
                <div className="hidden md:flex gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const today = new Date();
                            const start = new Date();
                            start.setDate(today.getDate() - 30);
                            setDateRange({ start: start.toISOString().split("T")[0], end: today.toISOString().split("T")[0] });
                        }}
                        className="h-9 px-2 text-xs text-gray-500"
                    >
                        30 días
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const today = new Date();
                            const start = new Date(today.getFullYear(), 0, 1);
                            setDateRange({ start: start.toISOString().split("T")[0], end: today.toISOString().split("T")[0] });
                        }}
                        className="h-9 px-2 text-xs text-gray-500"
                    >
                        Este Año
                    </Button>
                </div>
            </div>

            {/* Search Reference */}
            <div className="flex-1 w-full md:w-auto relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar Referencia, Nombre o Código..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={searchRef}
                    onChange={(e) => setSearchRef(e.target.value)}
                />
            </div>
        </div>
    );
}
