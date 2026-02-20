"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { FileText, Printer, Save, CheckCircle2, AlertTriangle, ArrowLeft, FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { SALES_CODES } from "@/lib/constants";
import { useInventory } from "@/hooks/useInventory";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import axios from "axios";
import { API_URL } from "@/lib/config";

// Mapa de nombres comunes (Fallback)
const DEFAULT_PRODUCT_NAMES: Record<string, string> = {
    "7007": "MAGIA CAPILAR PRE-SHAMPOO CRECIMIENTO",
    "7008": "ENCANTO CAPILAR SHAMPOO NEUTRO",
    "7009": "HECHIZO CAPILAR TRATAMIENTO LAMINADO",
    "7957": "SHAMPOO CRECIMIENTO ACTIVO 500ML",
    "7901": "ACONDICIONADOR REPARADOR INTENSIVO",
    "7101": "LOCION CAPILAR RESTAURA EXTREM",
    "7210": "CREMA PARA PEINAR TERMO PROTECTORA",
    "3005": "DUO RITUAL TENTACION",
    "3001": "COMBO RITUAL SEDUCCION",
    "3012": "KIT X3 REPARACION PROFUNDA",
    "7416": "MASCARILLA CAPILAR INTENSIVA",
    "EVO-7701": "EVOLUCION - PASO 1",
    "EVO-7702": "EVOLUCION - ALISADO",
    "EVO-7703": "EVOLUCION - SELLANTE",
    "7299": "TERMO PROTECTOR",
    "7701": "PASO 1 ANTIRESIDUOS",
    "7702": "PASO 2 ALISADO",
    "7703": "PASO 3 SELLANTE"
};

const COMPANIES = [
    "ARMONIA COSMETICA S.A.S.",
    "HECHIZO DE BELLEZA S.A.S.",
    "RAICES ORGANICAS S.A.S.",
    "RITUAL BOTANICO S.A.S.",
    "ALMAVERDE BEAUTY S.A.S.",
    "GRUPO HUMAN PROJECT S.A.S.",
    "ORIGEN BOTANICO S.A.S.",
    "APEGO COSMÉTICOS S.A.S."
];

const getAvailablePeriods = () => {
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const periods = [];
    const date = new Date();

    // Retroceder 6 meses desde el mes actual
    date.setMonth(date.getMonth() - 6);

    // Generar 13 meses (6 anteriores + actual + 6 siguientes)
    for (let i = 0; i <= 12; i++) {
        periods.push(`${months[date.getMonth()]} ${date.getFullYear()}`);
        date.setMonth(date.getMonth() + 1);
    }
    return periods;
};
const AVAILABLE_PERIODS = getAvailablePeriods();

interface ActaItem {
    sku: string;
    name: string;
    physical: number | '';
    system: number | '';
    unitPrice: number | '';
}

export default function CierreActasPage() {
    const { data: inventoryData } = useInventory();

    const [viewMode, setViewMode] = useState<"form" | "document">("form");

    // Acta Metadata
    const [companiesList, setCompaniesList] = useState<string[]>(COMPANIES);
    const [company, setCompany] = useState(COMPANIES[1]);
    const [consecutivo, setConsecutivo] = useState("024RO");
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [periodo, setPeriodo] = useState(() => {
        const d = new Date();
        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        return `${months[d.getMonth()]} ${d.getFullYear()}`;
    });
    const [observaciones, setObservaciones] = useState("");

    // Items
    const [items, setItems] = useState<ActaItem[]>(
        SALES_CODES.map(sku => ({
            sku,
            name: DEFAULT_PRODUCT_NAMES[sku] || `Producto ${sku}`,
            physical: '',
            system: '',
            unitPrice: ''
        }))
    );

    // Sincronizar nombres base de datos y empresas conectadas
    useEffect(() => {
        if (inventoryData && inventoryData.length > 0) {
            // Actualizar lista de empresas a las detectadas por APIs reales
            const uniqueCompanies = Array.from(
                new Set(inventoryData.map((d: any) => d.company || d.company_name))
            ).filter(Boolean) as string[];

            if (uniqueCompanies.length > 0) {
                setCompaniesList(uniqueCompanies.sort());
                if (!uniqueCompanies.includes(company)) {
                    setCompany(uniqueCompanies[0]); // Seleccionar una válida si la actual no existe en APIs
                }
            }

            // Actualizar el mapeo de nombres a los reales que trae SIIGO u otras APIS.
            const realNamesMap: Record<string, string> = {};
            inventoryData.forEach((d: any) => {
                if (d.code && d.name) {
                    realNamesMap[d.code] = d.name;
                }
            });

            setItems(prev => prev.map(item => ({
                ...item,
                name: realNamesMap[item.sku] || item.name
            })));
        }
    }, [inventoryData]);

    // Document Print logic
    const handlePrint = () => {
        window.print();
    };

    const handleGenerate = () => {
        setViewMode("document");
        toast.success("Acta generada. Lista para imprimir o guardar.");
    };

    const printRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleDownloadExcel = () => {
        const rows = processedItems.map(item => ({
            "Referencia": `${item.sku} - ${item.name}`,
            "Sistema (Und)": item.s,
            "Físico (Und)": item.p,
            "Diferencia": item.diff,
            "Estado": item.diff < 0 ? "Faltante" : item.diff > 0 ? "Sobrante" : "OK",
            "Costo Restado (Faltantes)": item.diff < 0 ? (Math.abs(item.diff) * (Number(item.unitPrice) || 0)) : 0
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Diferencias");
        XLSX.writeFile(wb, `Inventario_${company}_${fecha.replace(/-/g, "")}.xlsx`);
        toast.success("Excel descargado correctamente.");
    };

    const handleSaveActa = async () => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem("gco_token");
            if (!token) throw new Error("No hay token de sesión");

            const payload = {
                company, consecutivo, fecha, periodo, observaciones,
                items: processedItems,
                resumen: { totalReferencias, refConDiferencias, exactitud, totalUnidadesSistema, totalUnidadesDiferencia, exactitudUnidades }
            };

            const res = await axios.post(`${API_URL}/inventory/actas`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.status === "success") {
                toast.success("Acta guardada correctamente en el Historial");
            }
        } catch (error: any) {
            console.error("Error al guardar", error);
            toast.error(error.message || "Error al guardar el acta");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!printRef.current) return;
        toast.info("Generando PDF (esto puede tomar unos segundos)...", { id: "pdf_wait" });
        try {
            // Se usa clone para ajustar la vista al renderizar sin romper el original
            const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL("image/png");

            const pdf = new jsPDF("p", "mm", "a4");
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
            pdf.save(`Acta_Inventario_${company}_${fecha.replace(/-/g, "")}.pdf`);
            toast.success("PDF descargado", { id: "pdf_wait" });
        } catch (err) {
            console.error(err);
            toast.error("Error al generar el PDF", { id: "pdf_wait" });
        }
    };

    // Cálculos Derivados
    const processedItems = useMemo(() => {
        return items.map(item => {
            const p = Number(item.physical) || 0;
            const s = Number(item.system) || 0;
            const diff = p - s;
            return {
                ...item,
                p,
                s,
                diff
            };
        });
    }, [items]);

    const itemsWithDifferences = processedItems.filter(i => i.diff !== 0);
    const itemsFaltantes = processedItems.filter(i => i.diff < 0); // Faltantes (Cobrar a logística / responsable)
    const itemsSobrantes = processedItems.filter(i => i.diff > 0); // Sobrantes (Enviar a bodega de custodia)

    const totalReferencias = processedItems.length;
    const refConDiferencias = itemsWithDifferences.length;
    const exactitud = totalReferencias > 0 ? ((totalReferencias - refConDiferencias) / totalReferencias) * 100 : 0;

    const totalUnidadesSistema = processedItems.reduce((sum, item) => sum + item.s, 0);
    const totalUnidadesDiferencia = processedItems.reduce((sum, item) => sum + Math.abs(item.diff), 0);
    const exactitudUnidades = totalUnidadesSistema > 0 ? ((totalUnidadesSistema - totalUnidadesDiferencia) / totalUnidadesSistema) * 100 : 0;

    const totalDeudaEmpaques = itemsFaltantes.reduce((sum, item) => sum + (Math.abs(item.diff) * (Number(item.unitPrice) || 0)), 0);

    return (
        <div className="p-2 sm:p-6 bg-gray-50 min-h-screen">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: portrait; margin: 0; }
                    body { margin: 0; padding: 0; }
                    body * { visibility: hidden; }
                    .print-section, .print-section * { visibility: visible; }
                    .print-section { position: absolute; left: 0; top: 0; width: 100%; max-width: 100%; padding: 5mm 15mm 15mm 15mm; box-sizing: border-box; font-size: 11px; background: white; color: black; }
                    .no-print { display: none !important; }
                    aside, header, nav { display: none !important; }
                    table { page-break-inside: auto; border-collapse: collapse; width: 100%; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    th, td { border: 1px solid #ddd; padding: 4px; font-size: 10px; }
                    h1, h2, h3 { page-break-after: avoid; }
                }
            `}} />

            {viewMode === "form" ? (
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div>
                            <h1 className="text-2xl font-bold text-[#183C30] flex items-center gap-2">
                                <FileText className="h-6 w-6" />
                                Generador de Actas de Cierre
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">Ingresa el conteo físico y el saldo del sistema para generar el documento formal.</p>
                        </div>
                        <button
                            onClick={handleGenerate}
                            className="bg-[#183C30] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#122e24] transition-all flex items-center gap-2 shadow-sm"
                        >
                            <FileText className="h-5 w-5" />
                            Generar Acta
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Configuración */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2">Datos del Acta</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Empresa</label>
                                    <select
                                        value={company}
                                        onChange={(e) => setCompany(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#183C30]/20"
                                    >
                                        {companiesList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Consecutivo</label>
                                    <input
                                        type="text"
                                        value={consecutivo}
                                        onChange={(e) => setConsecutivo(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#183C30]/20"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Período de Cierre</label>
                                    <select
                                        value={periodo}
                                        onChange={(e) => setPeriodo(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#183C30]/20"
                                    >
                                        {AVAILABLE_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Fecha Elaboración</label>
                                    <input
                                        type="date"
                                        value={fecha}
                                        onChange={(e) => setFecha(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#183C30]/20"
                                    />
                                </div>
                                <div className="col-span-2 space-y-1 mt-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Observaciones Relevantes del Inventario</label>
                                    <textarea
                                        value={observaciones}
                                        onChange={(e) => setObservaciones(e.target.value)}
                                        placeholder="Ej: La mercancía de la estiba X estaba mojada. Hay 3 cajas rotas de producto 7001..."
                                        className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#183C30]/20 min-h-[80px]"
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        {/* Indicadores en Vivo */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2">Previsualización de Indicadores</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Refs. con Diferencias</p>
                                    <div className="flex items-end gap-2 mt-1">
                                        <h3 className="text-2xl font-bold text-yellow-600">{refConDiferencias}</h3>
                                        <span className="text-xs font-medium text-gray-400 mb-1">/ {totalReferencias} ref</span>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Unidades con Dif.</p>
                                    <div className="flex items-end gap-2 mt-1">
                                        <h3 className="text-2xl font-bold text-red-500">{totalUnidadesDiferencia}</h3>
                                        <span className="text-xs font-medium text-gray-400 mb-1">/ {totalUnidadesSistema} und</span>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Exactitud Esperada</p>
                                    <div className="flex items-end gap-2 mt-1">
                                        <h3 className={`text-2xl font-bold ${exactitud === 100 ? 'text-green-600' : 'text-orange-500'}`}>
                                            {exactitud.toFixed(1)}%
                                        </h3>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Exactitud Unds</p>
                                    <div className="flex items-end gap-2 mt-1">
                                        <h3 className={`text-2xl font-bold ${exactitudUnidades === 100 ? 'text-green-600' : 'text-orange-500'}`}>
                                            {exactitudUnidades.toFixed(1)}%
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de Captura */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <h3 className="font-bold text-gray-800">Conteo vs Sistema</h3>
                            <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                                {totalReferencias} Referencias de Venta
                            </span>
                        </div>
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-sm text-left relative">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">SKU</th>
                                        <th className="px-6 py-4 font-semibold">Nombre del Producto</th>
                                        <th className="px-6 py-4 font-semibold text-center w-32 border-x border-gray-200 bg-blue-50/50">Conteo Físico</th>
                                        <th className="px-6 py-4 font-semibold text-center w-32 border-r border-gray-200 bg-orange-50/50">Saldo Sistema</th>
                                        <th className="px-6 py-4 font-semibold text-center">Diferencia</th>
                                        <th className="px-6 py-4 font-semibold text-center w-32">Precio Unit. (Faltantes)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map((item, idx) => {
                                        const p = Number(item.physical) || 0;
                                        const s = Number(item.system) || 0;
                                        const diff = p - s;
                                        const hasDiff = item.physical !== '' && item.system !== '' && diff !== 0;
                                        const isFaltante = diff < 0;

                                        return (
                                            <tr key={item.sku} className="hover:bg-gray-50 focus-within:bg-green-50/20 transition-colors">
                                                <td className="px-6 py-3 font-mono text-gray-500">{item.sku}</td>
                                                <td className="px-6 py-3 font-medium text-gray-800">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => {
                                                            const newItems = [...items];
                                                            newItems[idx].name = e.target.value;
                                                            setItems(newItems);
                                                        }}
                                                        className="w-full bg-transparent border-b border-transparent hover:border-gray-200 focus:border-[#183C30] outline-none px-1 py-0.5 text-sm transition-all"
                                                    />
                                                </td>
                                                <td className="px-2 py-2 border-x border-gray-100 bg-blue-50/10 hover:bg-blue-50/30 transition-colors">
                                                    <input
                                                        type="number"
                                                        placeholder="0"
                                                        value={item.physical}
                                                        onChange={(e) => {
                                                            const newItems = [...items];
                                                            newItems[idx].physical = e.target.value === '' ? '' : Number(e.target.value);
                                                            setItems(newItems);
                                                        }}
                                                        className="w-full text-center bg-transparent border border-gray-200 hover:border-blue-300 focus:border-blue-500 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-bold transition-all"
                                                    />
                                                </td>
                                                <td className="px-2 py-2 border-r border-gray-100 bg-orange-50/10 hover:bg-orange-50/30 transition-colors">
                                                    <input
                                                        type="number"
                                                        placeholder="0"
                                                        value={item.system}
                                                        onChange={(e) => {
                                                            const newItems = [...items];
                                                            newItems[idx].system = e.target.value === '' ? '' : Number(e.target.value);
                                                            setItems(newItems);
                                                        }}
                                                        className="w-full text-center bg-transparent border border-gray-200 hover:border-orange-300 focus:border-orange-500 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 font-bold transition-all"
                                                    />
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    {item.physical === '' || item.system === '' ? (
                                                        <span className="text-gray-300">-</span>
                                                    ) : (
                                                        <span className={`font-bold px-3 py-1 rounded-full text-xs ${hasDiff ? (diff < 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700') : 'bg-green-100 text-green-700'}`}>
                                                            {diff > 0 ? '+' : ''}{diff}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 border-l border-gray-100 transition-colors text-right">
                                                    {isFaltante && (
                                                        <input
                                                            type="number"
                                                            placeholder="$0"
                                                            value={item.unitPrice}
                                                            onChange={(e) => {
                                                                const newItems = [...items];
                                                                newItems[idx].unitPrice = e.target.value === '' ? '' : Number(e.target.value);
                                                                setItems(newItems);
                                                            }}
                                                            className="w-full text-right bg-transparent border border-red-200 focus:border-red-500 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-red-500/20 transition-all font-mono"
                                                        />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* === DOCUMENT PRINT VIEW === */
                <div className="max-w-[800px] mx-auto bg-white shadow-xl min-h-screen relative print-section">

                    {/* Botonera Flotante (No Imprimible) */}
                    <div className="no-print sticky top-4 right-4 flex justify-end gap-2 p-4 z-50 flex-wrap">
                        <button
                            onClick={() => setViewMode("form")}
                            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
                        >
                            <ArrowLeft className="h-4 w-4" /> Editar
                        </button>

                        <button
                            onClick={handleDownloadExcel}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-all flex items-center gap-2 shadow-sm"
                        >
                            <FileSpreadsheet className="h-4 w-4" /> Excel
                        </button>

                        <button
                            onClick={handleDownloadPDF}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-all flex items-center gap-2 shadow-sm"
                        >
                            <FileDown className="h-4 w-4" /> PDF
                        </button>

                        <button
                            onClick={handlePrint}
                            className="bg-gray-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-900 transition-all flex items-center gap-2 shadow-sm"
                        >
                            <Printer className="h-4 w-4" /> Imprimir
                        </button>

                        <button
                            onClick={handleSaveActa}
                            disabled={isSaving}
                            className={`${isSaving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 shadow-sm ml-2`}
                        >
                            <Save className="h-4 w-4" /> {isSaving ? "Guardando..." : "Guardar Acta"}
                        </button>
                    </div>

                    {/* Hoja Formato A4 */}
                    <div ref={printRef} className="p-8 sm:p-12 print:p-2 text-[12px] leading-relaxed text-gray-900 font-sans bg-white pb-32 print:pb-0">

                        {/* Cabecera Profesional */}
                        <div className="border-b-2 border-[#183C30] pb-6 mb-8 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4">
                            <div>
                                <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider mb-2">Formato de Inventario FI-004 V2</h4>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#183C30] uppercase">ACTA OFICIAL DE CIERRE</h2>
                                <h1 className="text-lg sm:text-xl font-bold text-gray-700 mt-1 uppercase">{company}</h1>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-right min-w-[200px] shadow-sm">
                                <div className="text-[11px] font-semibold text-gray-500 uppercase mb-2">Información del Documento</div>
                                <p className="text-[12px]"><span className="text-gray-500">Consecutivo:</span> <strong className="text-[#183C30] font-mono">{consecutivo}</strong></p>
                                <p className="text-[12px]"><span className="text-gray-500">Elaboración:</span> <strong>{fecha}</strong></p>
                                <p className="text-[12px]"><span className="text-gray-500">Período:</span> <strong>{periodo.toUpperCase()}</strong></p>
                            </div>
                        </div>

                        <div className="bg-[#183C30]/5 border border-[#183C30]/20 p-5 rounded-lg mb-8 shadow-inner" style={{ pageBreakInside: 'avoid' }}>
                            <h4 className="font-bold text-[#183C30] text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Declaración Oficial de Responsabilidad y Alcance
                            </h4>
                            <p className="text-justify text-[11px] text-gray-800 leading-relaxed font-medium mb-3">
                                El presente documento tiene como propósito formalizar y certificar el resultado del conteo físico de mercancía correspondiente al período <strong>{periodo}</strong>. Las partes involucradas, representadas por el <strong>Área de Inventarios de {company}</strong> y el operador logístico externo <strong>EMPAQUES Y SOLUCIONES</strong>, validan en conjunto las cantidades aquí registradas. Se deja constancia de que los productos reportados como <em>Faltantes</em> o <em>Sobrantes</em> servirán como soporte fundamental para las conciliaciones de sistema y los debidos procesos administrativos o de cobro que el departamento contable determine, garantizando una gestión de inventario transparente.
                            </p>
                            <div className="bg-white/60 p-3 rounded border border-[#183C30]/10 text-justify text-[11px] text-[#183C30] font-medium">
                                <strong className="uppercase">Alcance y Ejecución:</strong> El Área de Inventarios proporciona y asegura que esta información en cantidades es veraz, confiable y certificada. Por su parte, el Área de Contabilidad será la directa responsable de ejecutar los respectivos ajustes de sistema y realizar los cobros financieros aquí mencionados.
                            </div>
                        </div>

                        {/* 1. Desarrollo */}
                        <div className="mb-6">
                            <h3 className="font-bold text-sm mb-2 text-[#183C30] border-b border-gray-200 pb-1">1. Desarrollo del Conteo Físico</h3>
                            <p className="text-justify mb-2">El conteo físico del inventario del período <strong>{periodo}</strong>. Para optimizar el proceso, se conformaron dos grupos de trabajo con las siguientes asignaciones:</p>
                            <ul className="list-disc pl-6 mb-2 space-y-1">
                                <li><strong>Grupo 1:</strong> Identificación con sticker color verde</li>
                                <li><strong>Grupo 2:</strong> Identificación con sticker color azul</li>
                            </ul>
                            <p className="text-justify mb-2">Para el reconteo y validación, se utilizó un sticker de color naranja.</p>
                            <p className="font-bold mt-3 mb-1">Metodología</p>
                            <p className="text-justify mb-2">Cada grupo realizó el conteo de acuerdo con la posición en estantería. Se verificaron cada estiba y, dentro de cada estiba, se auditaron al azar cajas seleccionadas. Una vez auditada una caja, se colocó el respectivo sticker de conteo para certificar la verificación.</p>
                            <div className="bg-gray-100 p-3 italic text-[11px] rounded border border-gray-200">
                                <strong>Notas aclaratorias:</strong> Todos los ajustes derivados del presente cierre de inventario serán realizados en la empresa GRUPO HUMAN PROJECT, conforme a los procedimientos establecidos para la regularización de diferencias físicas y contables.
                            </div>
                        </div>

                        {/* 2. Hallazgos */}
                        <div className="mb-6">
                            <h3 className="font-bold text-sm mb-3 text-[#183C30] border-b border-gray-200 pb-1">2. Hallazgos del Inventario</h3>
                            <p className="mb-2">Según el informe de inventario de <strong>{periodo}</strong>, se identificaron las siguientes novedades (Diferencias entre físico y sistema):</p>

                            {itemsWithDifferences.length === 0 ? (
                                <p className="italic text-gray-500 py-2">No se encontraron diferencias en este período. El inventario es exacto al sistema.</p>
                            ) : (
                                <table className="w-full border-collapse border border-gray-300 text-center text-[10px] mb-4">
                                    <thead className="bg-[#183C30] text-white">
                                        <tr>
                                            <th className="border border-gray-300 p-2 text-left">Referencia</th>
                                            <th className="border border-gray-300 p-2">Sistema (Und)</th>
                                            <th className="border border-gray-300 p-2">Físico (Und)</th>
                                            <th className="border border-gray-300 p-2">Diferencia</th>
                                            <th className="border border-gray-300 p-2">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemsWithDifferences.map(item => (
                                            <tr key={item.sku} className="hover:bg-gray-50">
                                                <td className="border border-gray-300 p-2 text-left font-medium">{item.sku} - {item.name}</td>
                                                <td className="border border-gray-300 p-2">{item.s}</td>
                                                <td className="border border-gray-300 p-2">{item.p}</td>
                                                <td className="border border-gray-300 p-2 font-bold">{item.diff > 0 ? `+${item.diff}` : item.diff}</td>
                                                <td className={`border border-gray-300 p-2 font-bold ${item.diff < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                    {item.diff < 0 ? 'Faltante' : 'Sobrante'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* 3. Novedades Pendientes */}
                        <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
                            <h3 className="font-bold text-sm mb-3 text-[#183C30] border-b border-gray-200 pb-1">3. Novedades Pendientes y Cobros</h3>
                            <p className="mb-3 text-justify">En esta sección se detallan las novedades: los saldos que se deben cobrar y los productos sobrantes para enviar a bodega de custodia. Como nuestro proveedor logístico es un tercero llamado <strong>Empaques y Soluciones</strong>, ellos deben pagar la mercancía faltante para asegurar que contabilidad realice el respectivo cobro.</p>

                            <h4 className="font-bold underline mb-2">Cobro a Empaques y Soluciones (Faltantes):</h4>
                            {itemsFaltantes.length > 0 ? (
                                <>
                                    <table className="w-full border-collapse border border-gray-300 text-[10px] mb-2 text-center">
                                        <thead className="bg-[#183C30] text-white">
                                            <tr>
                                                <th className="border border-gray-300 p-1 text-left">SKU - Producto</th>
                                                <th className="border border-gray-300 p-1">Unidades</th>
                                                <th className="border border-gray-300 p-1">Valor Unitario</th>
                                                <th className="border border-gray-300 p-1">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {itemsFaltantes.map(i => {
                                                const subtotal = Math.abs(i.diff) * (Number(i.unitPrice) || 0);
                                                return (
                                                    <tr key={i.sku}>
                                                        <td className="border border-gray-300 p-1 text-left"><strong>{i.sku}</strong> - {i.name}</td>
                                                        <td className="border border-gray-300 p-1">{Math.abs(i.diff)}</td>
                                                        <td className="border border-gray-300 p-1 font-mono">${(Number(i.unitPrice) || 0).toLocaleString()}</td>
                                                        <td className="border border-gray-300 p-1 font-mono">${subtotal.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr>
                                                <td colSpan={3} className="border border-gray-300 p-1 text-right font-bold uppercase bg-gray-100">Total a Cobrar a Empaques y Soluciones:</td>
                                                <td className="border border-gray-300 p-1 font-mono font-bold text-red-700 bg-red-50">${totalDeudaEmpaques.toLocaleString()}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </>
                            ) : <p className="italic text-gray-500 mb-4 text-[11px]">No hay productos faltantes para cobrar a Empaques y Soluciones.</p>}

                            <h4 className="font-bold underline mb-2 mt-4">Producto para enviar a bodega de custodia (Sobrantes):</h4>
                            {itemsSobrantes.length > 0 ? (
                                <ul className="list-disc pl-6 mb-2">
                                    {itemsSobrantes.map(i => (
                                        <li key={i.sku}><strong>{i.sku} - {i.name}:</strong> {i.diff} unidades.</li>
                                    ))}
                                </ul>
                            ) : <p className="italic text-gray-500 mb-2 text-[11px]">No hay productos sobrantes para enviar a custodia.</p>}
                        </div>

                        {/* 4. Acciones a Realizar */}
                        <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
                            <h3 className="font-bold text-sm mb-2 text-[#183C30] border-b border-gray-200 pb-1">4. Acciones a Realizar</h3>
                            <p className="text-justify mb-2">Se detallan las acciones correctivas que se llevarán a cabo para subsanar las diferencias encontradas en el inventario:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Cuando se deban hacer despachos desde Bogotá es importante tener en cuenta un documento físico que soporte ese despacho por medio de la remisión.</li>
                                <li>La empresa logística deberá garantizar la correcta ubicación y traslado de mercancía entre empresas.</li>
                                <li><strong>Conciliación previa al inventario:</strong> Se debe verificar la información interna antes del cierre de inventario para evitar discrepancias documentales.</li>
                                <li>Se recomienda a la empresa logística tomar acciones en la formación de dúos y combos, ya que estos productos afectan otras referencias. Se les enviarán los saldos de cierre, y antes del inventario, se comprometen a formar estas dos referencias.</li>
                                <li>Se recomienda al finalizar el mes debe estar toda la mercancía ingresada a siigo, documentada y facturada.</li>
                                <li>No se recomienda recibir vehículos con carga de mercancía el último día del mes previo al inventario.</li>
                            </ul>
                        </div>

                        {/* 5. Saldos Finales en el Sistema */}
                        <div className="mb-8" style={{ pageBreakInside: 'avoid' }}>
                            <h3 className="font-bold text-sm mb-3 text-[#183C30] border-b border-gray-200 pb-1">5. Saldos Finales en el Sistema</h3>
                            <p className="mb-2 italic text-[11px]">(Valores actualizados que deben quedar registrados en el sistema después de realizar los movimientos y ajustes necesarios - Igualan al Conteo Físico)</p>

                            <table className="w-full border-collapse border border-gray-300 text-[10px] mt-3">
                                <thead className="bg-[#183C30] text-white">
                                    <tr>
                                        <th className="border border-gray-300 p-1 text-left">SKU - Producto</th>
                                        <th className="border border-gray-300 p-1 text-center w-24">Saldo Inicial</th>
                                        <th className="border border-gray-300 p-1 text-center w-24">Ajuste</th>
                                        <th className="border border-gray-300 p-1 text-center w-24">Saldo Físico Real</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processedItems.map(item => (
                                        <tr key={item.sku} className="hover:bg-gray-50">
                                            <td className="border border-gray-300 p-1 text-left font-medium">{item.sku} - {item.name}</td>
                                            <td className="border border-gray-300 p-1 text-center">{item.s}</td>
                                            <td className={`border border-gray-300 p-1 text-center ${item.diff > 0 ? 'text-blue-600' : item.diff < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                {item.diff > 0 ? `+${item.diff} (Sobrante)` : item.diff < 0 ? `${item.diff} (Faltante)` : '0'}
                                            </td>
                                            <td className="border border-gray-300 p-1 text-center font-bold bg-green-50 text-[#183C30]">{item.p}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="mt-4 bg-yellow-50 border border-yellow-200 p-3 rounded text-[11px]">
                                <strong>Nota Adicional Promedio:</strong><br />
                                Los productos 3001 (Combo ritual seducción) y 3005 (Dúo ritual tentación) deben ser revisados para determinar ensambles o desensambles pendientes si aplica en Siigo al terminar.
                            </div>

                            {observaciones.trim() !== "" && (
                                <div className="mt-4 bg-blue-50 border border-blue-200 p-4 rounded text-[11px] text-justify text-blue-900 shadow-sm whitespace-pre-line">
                                    <strong className="text-blue-900 uppercase underline mb-1 block">Observaciones y Notas del Responsable de Inventario:</strong>
                                    {observaciones}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-8 mb-8" style={{ pageBreakInside: 'avoid' }}>
                            {/* 6. Ajustes y 7. Indicadores */}
                            <div className="w-1/2">
                                <h3 className="font-bold text-sm mb-2 text-[#183C30] border-b border-gray-200 pb-1">6. Ajustes Manuales Requeridos</h3>
                                <p className="text-justify mb-2">Según los hallazgos descritos, el equipo contable (GRUPO HUMAN PROJECT) procederá a realizar los ajustes en SIIGO (Entradas y Salidas por ajuste de inventario) para igualar el sistema a las cantidades físicas certificadas en el punto 5.</p>
                                <ul className="list-disc pl-5 mb-2 space-y-1 text-justify">
                                    <li><strong>Si es Faltante:</strong> Cobrar a <em>Empaques y Soluciones</em> el valor de la mercancía.</li>
                                    <li><strong>Si es Sobrante:</strong> Llevar a bodega de custodia, o ingresar a la BODEGA PRINCIPAL RIONEGRO, según indicación de Gerencia.</li>
                                </ul>
                            </div>

                            <div className="w-1/2">
                                <h3 className="font-bold text-sm mb-2 text-[#183C30] border-b border-gray-200 pb-1">7. Indicadores de Confiabilidad</h3>
                                <table className="w-full border-collapse border border-gray-300 text-[10px]">
                                    <tbody>
                                        <tr>
                                            <td className="border border-gray-300 p-2 font-medium bg-gray-50">Referencias Estudiadas (Venta)</td>
                                            <td className="border border-gray-300 p-2 text-center font-bold">{totalReferencias}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 p-2 font-medium bg-gray-50">Referencias con Diferencias</td>
                                            <td className="border border-gray-300 p-2 text-center font-bold text-red-600">{refConDiferencias}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 p-2 font-medium bg-gray-50">Total Unidades Sistema</td>
                                            <td className="border border-gray-300 p-2 text-center font-bold">{totalUnidadesSistema}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 p-2 font-medium bg-gray-50">Unidades con Diferencias</td>
                                            <td className="border border-gray-300 p-2 text-center font-bold text-red-600">{totalUnidadesDiferencia}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 p-2 font-medium bg-[#183C30] text-white">Exactitud Referencias</td>
                                            <td className="border border-gray-300 p-2 text-center font-bold bg-[#183C30] text-white">{exactitud.toFixed(2)}%</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 p-2 font-medium bg-[#183C30] text-white">Exactitud Unidades Totales</td>
                                            <td className="border border-gray-300 p-2 text-center font-bold bg-[#183C30] text-white">{exactitudUnidades.toFixed(2)}%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>


                        {/* 8. Conclusiones y Firmas */}
                        {/* 8. Conclusiones y Firmas */}
                        <div style={{ pageBreakInside: 'avoid' }}>
                            <h3 className="font-bold text-sm mb-2 text-[#183C30] border-b border-gray-200 pb-1">8. Conclusiones y Recomendaciones Contables</h3>
                            <p className="font-bold mt-2">1. Seguridad en el Almacenamiento y Custodia</p>
                            <p>Se exige al proveedor logístico garantizar un resguardo hermético de la mercancía. Todo cruce de información entre empresas debe estar soportado por remisiones físicas debidamente firmadas para evitar fugas no documentadas de inventario.</p>
                            <p className="font-bold mt-2">2. Política de Orden Documental</p>
                            <p>Es indispensable que todo movimiento físico de inventario durante el mes de cierre esté rigurosamente soportado en facturación electrónica o documento contable equivalente, evitando entregas basadas únicamente en acuerdos verbales.</p>
                            <p className="font-bold mt-2">3. Ensamblaje de Promocionales</p>
                            <p>Se insta al equipo logístico a armar previamenten los combos y dúos estipulados para evitar fraccionamiento de referencias unitarias que afecten las conciliaciones físicas de auditoría.</p>
                            <p className="font-bold mt-2">4. Prevención de Averías</p>
                            <p>Se recomienda implementar un protocolo de revisión rutinaria de estibas y estanterías, separando inmediatamente cualquier unidad con daño físico o deterioro de empaque hacia una bodega de "No Conformes", para no inflar los conteos de activos vendibles.</p>
                        </div>

                        {/* Firmas */}
                        <div className="mt-28 w-full" style={{ pageBreakInside: 'avoid' }}>
                            <div className="grid grid-cols-3 gap-8">
                                <div className="text-center">
                                    <div className="border-b border-black mb-1 mx-auto w-48"></div>
                                    <p className="font-bold mt-2 text-xs">________________________</p>
                                    <p className="italic text-gray-500 mt-1 uppercase text-[10px] font-bold">RESPONSABLE DE INVENTARIOS</p>
                                </div>
                                <div className="text-center">
                                    <div className="border-b border-black mb-1 mx-auto w-48"></div>
                                    <p className="font-bold mt-2 text-xs">________________________</p>
                                    <p className="italic text-gray-500 mt-1 uppercase text-[10px] font-bold">AUDITOR / REVISOR FISCAL</p>
                                </div>
                                <div className="text-center">
                                    <div className="border-b border-black mb-1 mx-auto w-48"></div>
                                    <p className="font-bold mt-2 text-xs">________________________</p>
                                    <p className="italic text-gray-500 mt-1 uppercase text-[10px] font-bold">REPRESENTANTE LEGAL / GERENCIA</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
