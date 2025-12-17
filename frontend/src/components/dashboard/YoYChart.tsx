
"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, CalendarDays, DollarSign, Package } from "lucide-react";
import { cn } from "@/lib/utils";

// Helper for formatting
const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
};

const formatUnits = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
};

interface YoYChartProps {
    data: any[];
    isLoading: boolean;
    targetYear: number;
}

export function YoYChart({ data, isLoading, targetYear }: YoYChartProps) {
    const [metric, setMetric] = useState<"money" | "units">("money");
    const [viewMode, setViewMode] = useState<"monthly" | "quarterly">("monthly");

    const currentYear = targetYear;
    const previousYear = targetYear - 1;

    const processedData = useMemo(() => {
        if (!data) return [];

        // Filter Sales Only
        const sales = data.filter((m: any) => m.doc_type === "FV");

        // Grouping Bucket
        type Bucket = { current: number; previous: number; label: string; sortParams: number };
        const buckets: Record<string, Bucket> = {};

        // Initialize Buckets
        if (viewMode === "monthly") {
            const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            months.forEach((m, i) => {
                buckets[m] = { current: 0, previous: 0, label: m, sortParams: i };
            });
        } else {
            const quarters = ["Q1", "Q2", "Q3", "Q4"];
            quarters.forEach((q, i) => {
                buckets[q] = { current: 0, previous: 0, label: q, sortParams: i };
            });
        }

        sales.forEach((m: any) => {
            const date = new Date(m.date); // Native Date parsing
            // Use UTC methods to avoid timezone shift causing day-off errors if needed, but local is usually fine for "Month" buckets.
            // Let's use getMonth() (0-11)

            const year = date.getFullYear();
            if (year !== currentYear && year !== previousYear) return;

            const value = metric === "money" ? m.total : m.quantity;
            const monthIndex = date.getMonth(); // 0 = Jan

            let key = "";
            if (viewMode === "monthly") {
                const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                key = months[monthIndex];
            } else {
                if (monthIndex < 3) key = "Q1";
                else if (monthIndex < 6) key = "Q2";
                else if (monthIndex < 9) key = "Q3";
                else key = "Q4";
            }

            if (buckets[key]) {
                if (year === currentYear) buckets[key].current += value;
                if (year === previousYear) buckets[key].previous += value;
            }
        });

        return Object.values(buckets).sort((a, b) => a.sortParams - b.sortParams);

    }, [data, metric, viewMode, currentYear, previousYear]);

    // KPIs
    const totalCurrent = processedData.reduce((acc, curr) => acc + curr.current, 0);
    const totalPrevious = processedData.reduce((acc, curr) => acc + curr.previous, 0);
    const growth = totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 : 0;

    return (
        <Card className="col-span-4 border-gray-100 shadow-sm mt-6">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-[#183C30] flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-purple-600" />
                            <span>Comparativa Anual ({previousYear} vs {currentYear})</span>
                        </CardTitle>
                        <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                            <span className={cn("flex items-center font-bold px-2 py-0.5 rounded text-xs", growth >= 0 ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50")}>
                                {growth >= 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                                {Math.abs(growth).toFixed(1)}%
                            </span>
                            <span>vs año anterior ({metric === "money" ? "Dinero" : "Unidades"})</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Toggle */}
                        <div className="bg-gray-100 p-1 rounded-lg flex text-xs mr-2">
                            <button
                                onClick={() => setViewMode("monthly")}
                                className={cn("px-3 py-1.5 rounded-md transition-all font-medium", viewMode === "monthly" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500")}
                            >
                                Mensual
                            </button>
                            <button
                                onClick={() => setViewMode("quarterly")}
                                className={cn("px-3 py-1.5 rounded-md transition-all font-medium", viewMode === "quarterly" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500")}
                            >
                                Trimestral
                            </button>
                        </div>

                        {/* Metric Toggle */}
                        <div className="bg-gray-100 p-1 rounded-lg flex text-xs">
                            <button
                                onClick={() => setMetric("units")}
                                className={cn("px-2 py-1.5 rounded-md transition-all font-medium", metric === "units" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500")}
                            >
                                <Package className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setMetric("money")}
                                className={cn("px-2 py-1.5 rounded-md transition-all font-medium", metric === "money" ? "bg-white text-green-700 shadow-sm" : "text-gray-500")}
                            >
                                <DollarSign className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                            <XAxis dataKey="label" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => metric === "money" ? formatCurrency(val) : formatUnits(val)} />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB' }}
                                formatter={(value: any) => metric === "money" ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value)) : new Intl.NumberFormat("es-CO").format(Number(value))}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar dataKey="previous" name={previousYear.toString()} fill="#E5E7EB" radius={[4, 4, 0, 0]} barSize={30} />
                            <Bar dataKey="current" name={currentYear.toString()} fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
