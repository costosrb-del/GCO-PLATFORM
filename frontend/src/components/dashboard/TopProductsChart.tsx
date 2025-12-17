
"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowDownRight, ArrowUpRight } from "lucide-react";
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

interface TopProductsChartProps {
    data: any[];
    isLoading: boolean;
    isError: boolean;
}

export function TopProductsChart({ data, isLoading, isError }: TopProductsChartProps) {
    // State
    const [metric, setMetric] = useState<"money" | "units">("units");
    const [viewType, setViewType] = useState<"sales" | "outflows">("sales"); // sales (FV) vs outflows (Everything else)

    const chartData = useMemo(() => {
        if (!data) return [];

        // 1. Filter by View Type
        const filtered = data.filter((m: any) => {
            if (viewType === "sales") return m.doc_type === "FV";
            // Outflows: "SALIDA" type generally, or excludes sales. 
            if (viewType === "outflows") {
                return m.type === "SALIDA" && m.doc_type !== "FV";
            }
            return false;
        });

        // 2. Aggregate by Product
        const grouped = filtered.reduce((acc: any, curr: any) => {
            // Use code as key, but keep name for display
            const key = curr.code || "Unknown";
            if (!acc[key]) {
                acc[key] = {
                    code: key,
                    name: curr.name || "Sin Nombre",
                    value: 0
                };
            }
            acc[key].value += metric === "money" ? curr.total : curr.quantity;
            return acc;
        }, {} as Record<string, { code: string, name: string, value: number }>);

        // 3. Sort and Top 10
        const sorted = Object.values(grouped).sort((a: any, b: any) => b.value - a.value);

        // Take Top 10 (Type safety for array)
        const top10 = sorted.slice(0, 10);

        return top10;

    }, [data, metric, viewType]);

    if (isError) {
        return (
            <div className="h-[300px] w-full flex items-center justify-center bg-red-50 rounded-xl border border-red-100 text-red-500">
                Error datos top
            </div>
        );
    }

    return (
        <Card className="col-span-1 border-gray-100 shadow-sm h-full">
            <CardHeader>
                <div className="flex flex-col gap-2">
                    <CardTitle className="text-[#183C30] flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                            {viewType === "sales" ? <ArrowUpRight className="h-4 w-4 text-green-600" /> : <ArrowDownRight className="h-4 w-4 text-orange-600" />}
                            <span>{viewType === "sales" ? "Top Productos (Ventas)" : "Top Otras Salidas"}</span>
                        </div>
                    </CardTitle>

                    {/* Controls */}
                    <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="bg-gray-100 p-1 rounded-lg flex text-[10px]">
                            <button
                                onClick={() => setViewType("sales")}
                                className={cn("px-2 py-1 rounded transition-all font-medium", viewType === "sales" ? "bg-white text-green-700 shadow-sm" : "text-gray-500")}
                            >
                                Ventas
                            </button>
                            <button
                                onClick={() => setViewType("outflows")}
                                className={cn("px-2 py-1 rounded transition-all font-medium", viewType === "outflows" ? "bg-white text-orange-700 shadow-sm" : "text-gray-500")}
                            >
                                Otras Salidas
                            </button>
                        </div>

                        <div className="bg-gray-100 p-1 rounded-lg flex text-[10px]">
                            <button
                                onClick={() => setMetric("units")}
                                className={cn("px-2 py-1 rounded transition-all font-medium", metric === "units" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500")}
                            >
                                Unid.
                            </button>
                            <button
                                onClick={() => setMetric("money")}
                                className={cn("px-2 py-1 rounded transition-all font-medium", metric === "money" ? "bg-white text-green-700 shadow-sm" : "text-gray-500")}
                            >
                                $
                            </button>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pl-0 pb-2">
                <div className="h-[350px] w-full">
                    {isLoading ? (
                        <div className="h-full w-full flex items-center justify-center text-gray-400">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs text-center p-4">
                            No hay datos para {viewType === "sales" ? "Ventas" : "Salidas"} en el periodo seleccionado.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={chartData} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F3F4F6" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={100}
                                    tick={{ fontSize: 10, fill: "#6B7280" }}
                                    interval={0}
                                    tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + "..." : val}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                                    formatter={(value: any) => [metric === "money" ? formatCurrency(Number(value)) : formatUnits(Number(value)), "Total"]}
                                />
                                <Bar
                                    dataKey="value"
                                    fill={viewType === "sales" ? "#10B981" : "#F97316"}
                                    radius={[0, 4, 4, 0]}
                                    barSize={20}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
