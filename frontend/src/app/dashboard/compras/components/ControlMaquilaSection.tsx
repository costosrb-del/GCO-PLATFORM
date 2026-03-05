import React, { useState, useMemo, useEffect } from "react";
import { ProductoFabricado } from "@/hooks/useCompras";
import { API_URL } from "@/lib/config";
import { Plus, Search, Calendar, Save, Beaker, CheckCircle2, ChevronDown, ChevronRight, X } from "lucide-react";

interface MaquilaProyeccion {
    id?: string;
    year: number;
    month: number;
    sku: string;
    nombre?: string;
    cantidad_solicitada: number;
}

interface MaquilaEntrega {
    id?: string;
    fechaRecepcion: string;
    sku: string;
    nombre?: string;
    cantidad: number;
    remision?: string;
}

interface ControlMaquilaProps {
    productos: ProductoFabricado[];
}

const MONTHS = [
    { value: 1, label: "Enero" },
    { value: 2, label: "Febrero" },
    { value: 3, label: "Marzo" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Mayo" },
    { value: 6, label: "Junio" },
    { value: 7, label: "Julio" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Septiembre" },
    { value: 10, label: "Octubre" },
    { value: 11, label: "Noviembre" },
    { value: 12, label: "Diciembre" }
];

export function ControlMaquilaSection({ productos }: ControlMaquilaProps) {
    const [year, setYear] = useState(new Date().getFullYear());
    const [proyecciones, setProyecciones] = useState<MaquilaProyeccion[]>([]);
    const [entregas, setEntregas] = useState<MaquilaEntrega[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Modes
    const [activeView, setActiveView] = useState<"matriz" | "registro_oc" | "registro_entrega">("matriz");

    // Form states
    const [planSku, setPlanSku] = useState("");
    const [planMonth, setPlanMonth] = useState<number>(new Date().getMonth() + 1);
    const [planQty, setPlanQty] = useState("");
    const [isSavingPlan, setIsSavingPlan] = useState(false);

    const [entregaSku, setEntregaSku] = useState("");
    const [entregaDate, setEntregaDate] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    });
    const [entregaQty, setEntregaQty] = useState("");
    const [entregaRemision, setEntregaRemision] = useState("");
    const [isSavingEntrega, setIsSavingEntrega] = useState(false);

    // Filter valid products (only those with SKU makes sense to track)
    const validProducts = useMemo(() => {
        return productos.filter(p => p.sku && p.sku.trim() !== "");
    }, [productos]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem("gco_token");
            const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

            const [resP, resE] = await Promise.all([
                fetch(`${API_URL}/compras/maquila/proyecciones/${year}`, { headers }),
                fetch(`${API_URL}/compras/maquila/entregas/${year}`, { headers })
            ]);

            if (resP.ok) {
                const dataP = await resP.json();
                setProyecciones(dataP.data || []);
            }
            if (resE.ok) {
                const dataE = await resE.json();
                setEntregas(dataE.data || []);
            }
        } catch (error) {
            console.error("Error fetching maquila data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year]);

    const handleSavePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!planSku || !planMonth || !planQty) return;

        setIsSavingPlan(true);
        try {
            const token = localStorage.getItem("gco_token");
            const payload = {
                year,
                month: planMonth,
                sku: planSku,
                nombre: validProducts.find(p => p.sku === planSku)?.nombre || "",
                cantidad_solicitada: parseInt(planQty)
            };

            const res = await fetch(`${API_URL}/compras/maquila/proyecciones`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setPlanQty("");
                fetchData();
                setActiveView("matriz");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingPlan(false);
        }
    };

    const handleSaveEntrega = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!entregaSku || !entregaDate || !entregaQty) return;

        setIsSavingEntrega(true);
        try {
            const token = localStorage.getItem("gco_token");
            const payload = {
                fechaRecepcion: entregaDate,
                sku: entregaSku,
                nombre: validProducts.find(p => p.sku === entregaSku)?.nombre || "",
                cantidad: parseInt(entregaQty),
                remision: entregaRemision
            };

            const res = await fetch(`${API_URL}/compras/maquila/entregas`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setEntregaQty("");
                setEntregaRemision("");
                fetchData();
                setActiveView("matriz");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingEntrega(false);
        }
    };

    // --- MATRIX CALCULATIONS ---
    const getMatrixCell = (month: number, sku: string) => {
        // Solicitado
        const proj = proyecciones.find(p => p.month === month && p.sku === sku);
        const solicitado = proj ? proj.cantidad_solicitada : 0;

        // Entregado in that month
        const ents = entregas.filter(e => {
            if (e.sku !== sku) return false;
            if (!e.fechaRecepcion) return false;
            // Parse month from ISO date YYYY-MM-DD
            const m = parseInt(e.fechaRecepcion.split("-")[1], 10);
            return m === month;
        });
        const entregado = ents.reduce((acc, curr) => acc + curr.cantidad, 0);

        return { solicitado, entregado };
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Beaker className="w-6 h-6 text-amber-500" />
                        Control Laboratorio (Maquilador)
                    </h2>
                    <p className="text-sm text-gray-500">Planificación anual y entregas recibidas</p>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={year}
                        onChange={e => setYear(parseInt(e.target.value))}
                        className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-[#183C30]"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => setActiveView("registro_oc")}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                    >
                        Proyectar (Solicitar)
                    </button>
                    <button
                        onClick={() => setActiveView("registro_entrega")}
                        className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-lg text-sm font-medium shadow-sm transition-colors"
                    >
                        + Registrar Entrega
                    </button>
                </div>
            </div>

            {activeView === "registro_oc" && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold">Ingresar Proyección (Solicitado)</h3>
                        <button onClick={() => setActiveView("matriz")} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSavePlan} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Mes</label>
                            <select
                                required
                                value={planMonth}
                                onChange={e => setPlanMonth(parseInt(e.target.value))}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            >
                                {MONTHS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Producto</label>
                            <select
                                required
                                value={planSku}
                                onChange={e => setPlanSku(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            >
                                <option value="">Selecciona producto...</option>
                                {validProducts.map(p => (
                                    <option key={p.sku} value={p.sku}>{p.nombre} ({p.sku})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Cant. Solicitada</label>
                            <input
                                required
                                type="number"
                                min="1"
                                value={planQty}
                                onChange={e => setPlanQty(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                                placeholder="Ej: 5000"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSavingPlan}
                            className="w-full h-[42px] bg-[#183C30] text-white hover:bg-[#0f2920] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {isSavingPlan ? "Guardando..." : "Guardar Meta"}
                        </button>
                    </form>
                </div>
            )}

            {activeView === "registro_entrega" && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold">Registrar Entrega de Laboratorio</h3>
                        <button onClick={() => setActiveView("matriz")} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSaveEntrega} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Fecha Recepción</label>
                            <input
                                required
                                type="date"
                                value={entregaDate}
                                onChange={e => setEntregaDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Producto</label>
                            <select
                                required
                                value={entregaSku}
                                onChange={e => setEntregaSku(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                            >
                                <option value="">Seleccionar...</option>
                                {validProducts.map(p => (
                                    <option key={p.sku} value={p.sku}>{p.nombre} ({p.sku})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Cant. Entregada</label>
                            <input
                                required
                                type="number"
                                min="1"
                                value={entregaQty}
                                onChange={e => setEntregaQty(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                                placeholder="Ej: 2500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Remisión (Opcional)</label>
                            <input
                                type="text"
                                value={entregaRemision}
                                onChange={e => setEntregaRemision(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                                placeholder="RM-001"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSavingEntrega}
                            className="w-full h-[42px] bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            {isSavingEntrega ? "Guardando..." : "Registrar"}
                        </button>
                    </form>
                </div>
            )}

            {/* MATRIX UI */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#183C30]" />
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-[#183C30] text-emerald-50">
                            <tr>
                                <th rowSpan={2} className="px-4 py-3 font-semibold border-r border-[#2A5E4D] sticky left-0 z-20 bg-[#183C30]">
                                    MES
                                </th>
                                {validProducts.map(p => (
                                    <th key={p.sku} colSpan={2} className="px-4 py-2 font-medium text-center border-b border-r border-[#2A5E4D] max-w-[200px] truncate" title={p.nombre}>
                                        {p.nombre}
                                    </th>
                                ))}
                            </tr>
                            <tr className="bg-[#1e4a3c]">
                                {validProducts.map(p => (
                                    <React.Fragment key={`${p.sku}-sub`}>
                                        <th className="px-3 py-1 text-[11px] font-medium border-r border-[#2A5E4D] text-center w-24">solicitado</th>
                                        <th className="px-3 py-1 text-[11px] font-medium border-r border-[#2A5E4D] text-center w-24">entregado</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {MONTHS.map(month => (
                                <tr key={month.value} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-2.5 font-medium text-gray-900 border-r border-gray-100 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10">
                                        {month.label}
                                    </td>
                                    {validProducts.map(p => {
                                        const sku = p.sku || "";
                                        const { solicitado, entregado } = getMatrixCell(month.value, sku);
                                        return (
                                            <React.Fragment key={`${month.value}-${sku}`}>
                                                <td className="px-3 py-2 text-center border-r border-gray-100 font-medium text-gray-600 bg-gray-50/30">
                                                    {solicitado === 0 ? "-" : solicitado.toLocaleString()}
                                                </td>
                                                <td className={`px-3 py-2 text-center border-r border-gray-100 font-bold ${entregado > 0 ? "text-[#183C30]" : "text-gray-400"}`}>
                                                    {entregado === 0 ? "-" : entregado.toLocaleString()}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-black text-gray-800 border-t-2 border-gray-300">
                            <tr>
                                <td className="px-4 py-3 border-r border-gray-300 sticky left-0 bg-gray-100 z-10">
                                    TOTAL {year}
                                </td>
                                {validProducts.map(p => {
                                    const sku = p.sku || "";
                                    let totalSol = 0;
                                    let totalEnt = 0;
                                    MONTHS.forEach(m => {
                                        const { solicitado, entregado } = getMatrixCell(m.value, sku);
                                        totalSol += solicitado;
                                        totalEnt += entregado;
                                    });

                                    // Cumplimiento KPI
                                    const percent = totalSol > 0 ? (totalEnt / totalSol) * 100 : 0;
                                    let pillColor = "bg-gray-200 text-gray-600";
                                    if (totalSol > 0) {
                                        if (percent >= 90) pillColor = "bg-emerald-100 text-emerald-800";
                                        else if (percent >= 50) pillColor = "bg-amber-100 text-amber-800";
                                        else pillColor = "bg-red-100 text-red-800";
                                    }

                                    return (
                                        <React.Fragment key={`total-${sku}`}>
                                            <td className="px-3 py-3 text-center border-r border-gray-300">
                                                {totalSol.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-3 text-center border-r border-gray-300">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span>{totalEnt.toLocaleString()}</span>
                                                    {totalSol > 0 && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${pillColor}`}>
                                                            {percent.toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

        </div>
    );
}
