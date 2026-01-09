"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, RefreshCcw, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { API_URL } from "@/lib/config";

interface JuegoItem {
    sku: string;
    name: string;
    initial_balance: number;
    entries: number;
    exits: number;
    final_balance: number;
}

export default function JuegoInventariosPage() {
    const [data, setData] = useState<JuegoItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem("gco_token");
            if (!token) {
                alert("No session found");
                return;
            }

            // Defaulting to company 0 for now as per previous logic assumptions
            // If user needs to select company, we can add a selector later.
            const response = await axios.get(`${API_URL}/juego-inventario/?company_index=0`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data && response.data.data) {
                setData(response.data.data);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            alert("Error al cargar el Juego de Inventarios. Verifique la conexión.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const exportToExcel = () => {
        if (data.length === 0) return;

        const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
            "SKU": item.sku,
            "Nombre": item.name,
            "Saldo Inicial": item.initial_balance,
            "Entradas": item.entries,
            "Salidas (Fact - NC)": item.exits,
            "Saldo Final": item.final_balance
        })));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Juego Inventarios");
        XLSX.writeFile(workbook, `Juego_Inventarios_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const formatNumber = (val: number) => {
        return new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(val);
    };

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-[#183C30]">Juego de Inventarios (Mes Actual)</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-gray-500">
                            Datos combinados: Google Sheet (Inicial/Entradas) + Siigo (Salidas Netas)
                        </span>
                        {lastUpdated && (
                            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                                Actualizado: {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-[#183C30] transition-colors disabled:opacity-50"
                    >
                        <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline font-medium">Actualizar</span>
                    </button>

                    <button
                        onClick={exportToExcel}
                        disabled={data.length === 0 || isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-[#183C30] text-white rounded-xl hover:bg-[#122e24] transition-all shadow-lg shadow-[#183C30]/20 disabled:opacity-50 disabled:shadow-none"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span className="hidden sm:inline font-medium">Exportar Excel</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {isLoading && data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <Loader2 className="h-10 w-10 animate-spin mb-4 text-[#183C30]" />
                        <p>Cargando datos de inventario...</p>
                        <p className="text-xs mt-2">Esto puede tomar unos momentos al consultar Siigo.</p>
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <p>No se encontraron datos.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">SKU</th>
                                    <th className="px-6 py-4 font-semibold">Nombre</th>
                                    <th className="px-6 py-4 font-semibold text-right text-blue-600 bg-blue-50/30">Saldo Inicial</th>
                                    <th className="px-6 py-4 font-semibold text-right text-green-600 bg-green-50/30">Entradas</th>
                                    <th className="px-6 py-4 font-semibold text-right text-red-600 bg-red-50/30">Salidas (Fact - NC)</th>
                                    <th className="px-6 py-4 font-semibold text-right text-[#183C30] bg-gray-100">Saldo Final</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.map((item, idx) => (
                                    <tr key={`${item.sku}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.sku}</td>
                                        <td className="px-6 py-4 text-gray-600 max-w-[300px] truncate" title={item.name}>{item.name}</td>
                                        <td className="px-6 py-4 text-right font-medium bg-blue-50/10">{formatNumber(item.initial_balance)}</td>
                                        <td className="px-6 py-4 text-right font-medium text-green-600 bg-green-50/10">+{formatNumber(item.entries)}</td>
                                        <td className="px-6 py-4 text-right font-medium text-red-600 bg-red-50/10">-{formatNumber(item.exits)}</td>
                                        <td className="px-6 py-4 text-right font-bold text-[#183C30] bg-gray-50">{formatNumber(item.final_balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
