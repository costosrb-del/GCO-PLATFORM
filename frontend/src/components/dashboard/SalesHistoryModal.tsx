"use client";

import { useMemo, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { API_URL } from "@/lib/config";

interface SalesHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    sku: string;
    productName: string;
    currentStock: number;
    days: number;
}

export function SalesHistoryModal({ isOpen, onClose, sku, productName, currentStock, days }: SalesHistoryModalProps) {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && sku) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const token = localStorage.getItem("gco_token");
                    if (!token) return;

                    // Fetch history
                    const res = await axios.get(`${API_URL}/inventory/analysis/history`, {
                        params: {
                            sku: sku,
                            days: days || 30, // Fallback
                            current_stock: currentStock
                        },
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (res.data) {
                        setData(res.data);
                    }
                } catch (error) {
                    console.error("Error fetching history:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [isOpen, sku, days, currentStock]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl bg-white rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center justify-between">
                        <div>
                            <span className="text-[#183C30] block">Análisis de Comportamiento</span>
                            <span className="text-sm font-normal text-gray-500">{productName} (SKU: {sku})</span>
                        </div>
                        <div className="text-right mr-8">
                            <span className="text-xs text-gray-400 block uppercase">Stock Actual</span>
                            <span className={`text-2xl font-bold ${currentStock > 0 ? "text-blue-600" : "text-red-600"}`}>
                                {currentStock.toFixed(0)} u
                            </span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="h-[400px] w-full mt-4">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="h-8 w-8 text-[#183C30] animate-spin" />
                            <span className="ml-2 text-gray-500">Analizando movimientos...</span>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid stroke="#f5f5f5" strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    scale="point"
                                    padding={{ left: 10, right: 10 }}
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(val) => val.substring(5)} // Show MM-DD
                                />
                                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" label={{ value: 'Stock (u)', angle: -90, position: 'insideLeft' }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: 'Ventas (u)', angle: 90, position: 'insideRight' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend />
                                <Bar yAxisId="right" dataKey="sales" name="Ventas Diarias" barSize={20} fill="#4ade80" radius={[4, 4, 0, 0]} />
                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="stock"
                                    name="Nivel de Stock"
                                    stroke="#ef4444"
                                    strokeWidth={3}
                                    dot={{ r: 3 }}
                                    activeDot={{ r: 6 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>
                <div className="text-center text-xs text-gray-400 mt-2">
                    * La línea roja muestra la simulación del stock basada en las ventas detectadas.
                </div>
            </DialogContent>
        </Dialog>
    );
}
