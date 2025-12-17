
"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Package } from "lucide-react";
import { cn } from "@/lib/utils";

// Helper for currency formatting
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const formatUnits = (value: number) => {
    return new Intl.NumberFormat("es-CO").format(value);
};

interface SalesTrendChartProps {
    data: any[];
    isLoading: boolean;
    isError: boolean;
    searchRef?: string;
}

export function SalesTrendChart({ data, isLoading, isError, searchRef = "" }: SalesTrendChartProps) {
    // Filters State (Local Metric only, Global Date/Ref are passed)
    const [metric, setMetric] = useState<"money" | "units">("units");

    const chartData = useMemo(() => {
        if (!data) return [];

        // 1. Filter Mechanism
        let filtered = data.filter((m: any) => m.doc_type === "FV"); // Always Sales

        // Ref Filter (Global)
        if (searchRef) {
            const term = searchRef.toLowerCase();
            filtered = filtered.filter((m: any) =>
                (m.code && m.code.toLowerCase().includes(term)) ||
                (m.name && m.name.toLowerCase().includes(term))
            );
        }

        // 2. Aggregate by date
        const grouped = filtered.reduce((acc: any, curr: any) => {
            const date = curr.date;
            if (!acc[date]) {
                acc[date] = 0;
            }
            acc[date] += metric === "money" ? curr.total : curr.quantity;
            return acc;
        }, {} as Record<string, number>);

        // 3. Transform to array and sort
        return Object.entries(grouped)
            .map(([date, total]) => ({
                date,
                total, // Type is unknown without casting, but logic holds
            }))
            .sort((a: any, b: any) => a.date.localeCompare(b.date));
    }, [data, metric, searchRef]);

    const totalValue = useMemo(() => {
        return chartData.reduce((acc: any, curr: any) => acc + curr.total, 0);
    }, [chartData]);

    if (isError) {
        return (
            <Card className="col-span-4 border-red-100 bg-red-50 text-red-500 flex items-center justify-center h-[300px]">
                Error al cargar datos
            </Card>
        );
    }

    return (
        <Card className="col-span-4 border-gray-100 shadow-sm">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-[#183C30] flex items-center gap-2">
                            {metric === "money" ? <TrendingUp className="h-5 w-5 text-green-600" /> : <Package className="h-5 w-5 text-blue-600" />}
                            <span>Tendencia de Ventas ({metric === "money" ? "Dinero" : "Unidades"})</span>
                        </CardTitle>
                        <div className="text-sm text-gray-500 mt-1">
                            {/* Date range is now global, shown at top */}
                            Visualizando periodo seleccionado
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Metric Toggle */}
                        <div className="bg-gray-100 p-1 rounded-lg flex text-xs">
                            <button
                                onClick={() => setMetric("units")}
                                className={cn("px-3 py-1.5 rounded-md transition-all font-medium", metric === "units" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                            >
                                Unidades
                            </button>
                            <button
                                onClick={() => setMetric("money")}
                                className={cn("px-3 py-1.5 rounded-md transition-all font-medium", metric === "money" ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-900")}
                            >
                                Dinero
                            </button>
                        </div>
                    </div>
                </div>

                {/* Global Filter Replaces Local Filter Inputs */}

                {/* KPI Big Number */}
                <div className="mt-2">
                    <div className={cn("text-3xl font-bold", metric === "money" ? "text-green-700" : "text-blue-700")}>
                        {isLoading ? (
                            <div className="h-8 w-32 bg-gray-100 animate-pulse rounded" />
                        ) : (
                            metric === "money" ? formatCurrency(totalValue) : formatUnits(totalValue)
                        )}
                    </div>
                </div>

            </CardHeader>

            <CardContent className="pl-0">
                <div className="h-[350px] w-full mt-4">
                    {isLoading ? (
                        <div className="h-full w-full flex items-center justify-center text-gray-400">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-200 m-4 w-auto">
                            <div className="flex flex-col items-center p-6 text-center">
                                <span className="font-medium text-gray-500">No hay datos</span>
                                <span className="text-xs text-gray-400 mt-1 max-w-[200px]">
                                    Ajusta los filtros globales para ver resultados.
                                </span>
                            </div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={metric === "money" ? "#10B981" : "#3B82F6"} stopOpacity={0.1} />
                                        <stop offset="95%" stopColor={metric === "money" ? "#10B981" : "#3B82F6"} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9CA3AF"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => {
                                        // "YYYY-MM-DD" -> "DD/MM"
                                        const parts = value.split('-');
                                        return `${parts[2]}/${parts[1]}`;
                                    }}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#9CA3AF"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => {
                                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                                        return value;
                                    }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [metric === "money" ? formatCurrency(value) : formatUnits(value), metric === "money" ? "Ventas" : "Unidades"]}
                                    labelStyle={{ color: '#6B7280', fontSize: '12px', marginBottom: '4px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke={metric === "money" ? "#10B981" : "#3B82F6"}
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorMetric)"
                                    animationDuration={500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
