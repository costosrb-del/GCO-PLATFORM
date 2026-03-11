"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { FileText, Printer, Save, CheckCircle2, AlertTriangle, ArrowLeft, FileDown, FileSpreadsheet, History, LayoutGrid, Calendar, Download } from "lucide-react";
import { toast } from "sonner";
import { SALES_CODES } from "@/lib/constants";
import { useInventory } from "@/hooks/useInventory";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import axios from "axios";
import { API_URL } from "@/lib/config";

const DEFAULT_PRODUCT_NAMES: Record<string, string> = {
    "3001": "COMBO ROSADO RITUAL DE SEDUCCIÓN",
    "3005": "DUO PERFUME TERMOPROTECTOR",
    "3012": "DÚO PERFUMES MINI",
    "7007": "SHAMPOO DE CEBOLLA SOS",
    "7008": "SHAMPOO DE ROMERO CONTROL GRASA",
    "7009": "SHAMPOO DE AJI CONTROL CASPA",
    "7101": "MANTEQUILLA PERFUMADA",
    "7210": "TRATAMIENTO INTENSIVO PLEX",
    "7299": "MASCARILLA BOMBA BOTANICA SOS",
    "7416": "BRONCEADOR RITUAL DE SOL",
    "EVO-7701": "KIT EVOLUCION DE LA KERATINA 1000ML",
    "EVO-7702": "KIT EVOLUCIÓN DE LA KERATINA 250 ML",
    "EVO-7703": "KIT EVOLUCIÓN DE LA KERATINA 120 ML",
    "7901": "PERFUME TERMOPROTECTOR ROSADO",
    "7957": "PERFUME TERMOPROTECTOR AZUL",
    "3033": "COMBO ULTRA REPARADOR CEBOLLA",
    "3045": "COMBO CONTROL GRASA",
    "3055": "COMBO CONTROL CASPA"
};

const COMPANIES = [
    "ARMONIA COSMETICA S.A.S.",
    "HECHIZO DE BELLEZA S.A.S.",
    "RAICES ORGANICAS S.A.S.",
    "RITUAL BOTANICO S.A.S.",
    "ALMAVERDE BEAUTY S.A.S.",
    "GRUPO HUMAN PROJECT S.A.S.",
    "ORIGEN BOTANICO S.A.S."
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
    
    // Bodegas Principales
    bPrincipal: number | '';
    bAverias: number | '';
    bComercExt: number | '';
    bLibre: number | '';
    
    // Bodegas de Justificación
    bTransito: number | '';
    bPerdida: number | '';
    bDos: number | '';
    justificacion: string;

    // Unidades Libres (NUEVO)
    physicalFree: number | '';
    systemFree: number | '';

    system: number | ''; // Calculado
    unitPrice: number | '';
}

export default function CierreActasPage() {
    const { data: inventoryData } = useInventory();

    const [viewMode, setViewMode] = useState<"form" | "document">("form");
    const [viewTab, setViewTab] = useState<"create" | "drafts" | "history">("create");

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
    const [status, setStatus] = useState<"draft" | "final">("draft");
    const [actaId, setActaId] = useState<string | null>(null);
    const [savedActas, setSavedActas] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Items
    const [items, setItems] = useState<ActaItem[]>(
        SALES_CODES.map(sku => ({
            sku,
            name: DEFAULT_PRODUCT_NAMES[sku] || `Producto ${sku}`,
            physical: '',
            bPrincipal: '',
            bAverias: '',
            bComercExt: '',
            bLibre: '',
            bTransito: '',
            bPerdida: '',
            bDos: '',
            justificacion: '',
            system: '',
            unitPrice: '',
            physicalFree: '',
            systemFree: ''
        }))
    );

    // Sincronizar nombres base de datos y empresas conectadas
    useEffect(() => {
        if (inventoryData && inventoryData.length > 0) {
            const uniqueCompanies = Array.from(
                new Set(inventoryData.map((d: any) => d.company || d.company_name))
            ).filter(Boolean) as string[];

            if (uniqueCompanies.length > 0) {
                setCompaniesList(uniqueCompanies.sort());
                if (!uniqueCompanies.includes(company)) {
                    setCompany(uniqueCompanies[0]);
                }
            }

            const realNamesMap: Record<string, string> = {};
            inventoryData.forEach((d: any) => {
                if (d.code && d.name) {
                    realNamesMap[d.code] = d.name;
                }
            });

            setItems(prevItems => prevItems.map(item => ({
                ...item,
                name: realNamesMap[item.sku] || item.name
            })));
        }
    }, [inventoryData]);

    const fetchActas = async () => {
        setIsLoadingHistory(true);
        try {
            const response = await axios.get(`${API_URL}/inventory/actas`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("gco_token")}` }
            });
            setSavedActas(response.data || []);
        } catch (error) {
            console.error("Error fetching actas:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchActas();
    }, []);

    const handleLoadActa = (acta: any) => {
        if (!acta || !acta.data) return;
        setActaId(acta.id);
        setStatus(acta.status || "draft");
        setCompany(acta.data.company);
        setConsecutivo(acta.data.consecutivo);
        setFecha(acta.data.fecha);
        setPeriodo(acta.data.periodo);
        setObservaciones(acta.data.observaciones || "");
        setItems(acta.data.items || []);
        setViewTab("create");
        toast.success(`Acta ${acta.id} cargada correctamente`);
    };

    const handleNewActa = () => {
        setActaId(null);
        setStatus("draft");
        setObservaciones("");
        setItems(SALES_CODES.map(sku => ({
            sku,
            name: DEFAULT_PRODUCT_NAMES[sku] || `Producto ${sku}`,
            physical: '', bPrincipal: '', bAverias: '', bComercExt: '', bLibre: '', bTransito: '', bPerdida: '', bDos: '', justificacion: '', system: '', unitPrice: '', physicalFree: '', systemFree: ''
        })));
        // Reset name with inventory data if available
        if (inventoryData) {
            const realNamesMap: Record<string, string> = {};
            inventoryData.forEach((d: any) => { if (d.code && d.name) realNamesMap[d.code] = d.name; });
            setItems(prev => prev.map(i => ({ ...i, name: realNamesMap[i.sku] || i.name })));
        }
        setViewTab("create");
        toast.info("Formulario limpiado para nueva acta");
    };

    const updateItem = (index: number, field: keyof ActaItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const processedItems = useMemo(() => {
        return items.map(i => {
            const s_base = (Number(i.bPrincipal) || 0) + (Number(i.bAverias) || 0) + (Number(i.bComercExt) || 0) + (Number(i.bLibre) || 0);
            const s_free = Number(i.systemFree) || 0;
            const p_base = Number(i.physical) || 0;
            const p_free = Number(i.physicalFree) || 0;
            
            return {
                ...i,
                s: s_base,
                s_free: s_free,
                s_total: s_base + s_free,
                p: p_base,
                p_free: p_free,
                p_total: p_base + p_free,
                diff: (p_base + p_free) - (s_base + s_free),
                bTr: Number(i.bTransito) || 0,
                bPer: Number(i.bPerdida) || 0,
                bD: Number(i.bDos) || 0
            };
        });
    }, [items]);

    const totalUnidadesSistema = useMemo(() => processedItems.reduce((sum, i) => sum + i.s_total, 0), [processedItems]);
    const totalUnidadesFisicas = useMemo(() => processedItems.reduce((sum, i) => sum + i.p_total, 0), [processedItems]);
    const totalUnidadesDiferencia = useMemo(() => processedItems.reduce((sum, i) => sum + Math.abs(i.diff), 0), [processedItems]);
    const refConDiferencias = useMemo(() => processedItems.filter(i => (i.physical !== '' || i.physicalFree !== '') && i.diff !== 0).length, [processedItems]);
    const totalReferencias = useMemo(() => processedItems.filter(i => (i.physical !== '' || i.physicalFree !== '') || i.s_total > 0).length, [processedItems]);

    const itemsWithDifferences = useMemo(() => processedItems.filter(i => (i.physical !== '' || i.physicalFree !== '') && i.diff !== 0), [processedItems]);
    const itemsFaltantes = useMemo(() => itemsWithDifferences.filter(i => i.diff < 0), [itemsWithDifferences]);
    const itemsSobrantes = useMemo(() => itemsWithDifferences.filter(i => i.diff > 0), [itemsWithDifferences]);
    const displayComparisonItems = useMemo(() => itemsWithDifferences.concat(processedItems.filter(i => i.diff === 0 && i.s_total > 0)).slice(0, 100), [itemsWithDifferences, processedItems]);

    const exactitud = useMemo(() => totalReferencias > 0 ? ((totalReferencias - refConDiferencias) / totalReferencias) * 100 : 100, [totalReferencias, refConDiferencias]);
    const exactitudUnidades = useMemo(() => totalUnidadesSistema > 0 ? (1 - (totalUnidadesDiferencia / totalUnidadesSistema)) * 100 : 100, [totalUnidadesSistema, totalUnidadesDiferencia]);

    const totalDeudaEmpaques = useMemo(() => 
        itemsFaltantes.reduce((sum, i) => sum + (Math.abs(i.diff) * (Number(i.unitPrice) || 0)), 0), 
    [itemsFaltantes]);

    const [isSaving, setIsSaving] = useState(false);
    const handleSaveActa = async (newStatus: "draft" | "final") => {
        setIsSaving(true);
        try {
            const payload = {
                id: actaId || `acta-${Date.now()}`,
                status: newStatus,
                date: new Date().toISOString(),
                data: { company, consecutivo, fecha, periodo, observaciones, items }
            };
            await axios.post(`${API_URL}/inventory/actas`, payload, {
                headers: { Authorization: `Bearer ${localStorage.getItem("gco_token")}` }
            });
            setStatus(newStatus);
            setActaId(payload.id);
            toast.success(newStatus === 'final' ? "Acta cerrada y firmada correctamente" : "Borrador guardado");
            fetchActas();
        } catch (error) {
            toast.error("Error al guardar acta");
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerate = () => setViewMode("document");
    const [isPrinting, setIsPrinting] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => window.print();

    const handleDownloadPDF = async () => {
        if (!printRef.current) return;
        setIsPrinting(true);
        const toastId = toast.loading("Generando PDF profesional...");

        try {
            const canvas = await html2canvas(printRef.current, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
                windowWidth: 800
            });

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            
            const renderWidth = imgWidth * ratio;
            const renderHeight = imgHeight * ratio;
            
            const marginX = (pdfWidth - renderWidth) / 2;
            const marginY = 15; // Un margen superior decente

            // Si es más largo que una página
            if (renderHeight > (pdfHeight - 20)) {
                let heightLeft = renderHeight;
                let position = marginY;
                let page = 1;

                while (heightLeft > 0) {
                    pdf.addImage(imgData, 'PNG', marginX, position, renderWidth, renderHeight);
                    heightLeft -= (pdfHeight - 10);
                    position -= (pdfHeight - 10);
                    if (heightLeft > 0) {
                        pdf.addPage();
                        page++;
                    }
                }
            } else {
                pdf.addImage(imgData, 'PNG', marginX, marginY, renderWidth, renderHeight);
            }

            pdf.save(`Acta_Inventario_${company.split(' ')[0]}_${periodo.replace(' ', '_')}.pdf`);
            toast.success("PDF generado correctamente", { id: toastId });
        } catch (error) {
            console.error("PDF Error:", error);
            toast.error("Error al generar PDF", { id: toastId });
        } finally {
            setIsPrinting(false);
        }
    };

    const handleDownloadExcel = () => {
        const data = processedItems.filter(i => i.s_total > 0 || i.p_total > 0).map(i => ({
            "SKU": i.sku,
            "Producto": i.name,
            "Físico Base": i.p,
            "Libres F": i.p_free,
            "Total Físico": i.p_total,
            "Principal (S)": i.bPrincipal,
            "Averías (S)": i.bAverias,
            "Comercial (S)": i.bComercExt,
            "Libre (S)": i.bLibre,
            "Libres Sheets": i.s_free,
            "Total Sistema": i.s_total,
            "Diferencia": i.diff,
            "Tránsito": i.bTr,
            "Pérdida": i.bPer,
            "Bodega 2": i.bD,
            "Justificación": i.justificacion
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");
        XLSX.writeFile(wb, `Inventario_${company}_${periodo}.xlsx`);
    };

    const printRefContent = useRef<HTMLDivElement>(null);

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20 pt-10">
            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    .print-section { 
                        box-shadow: none !important; 
                        border: none !important; 
                        padding: 20mm !important;
                        width: 100% !important;
                    }
                }
                .watermark {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 15rem;
                    font-weight: 900;
                    color: rgba(0,0,0,0.03);
                    pointer-events: none;
                    z-index: 0;
                    white-space: nowrap;
                    text-transform: uppercase;
                }
                .status-badge {
                    position: absolute;
                    top: 2rem;
                    right: 2rem;
                    padding: 0.5rem 1rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 900;
                    letter-spacing: 0.05em;
                    z-index: 10;
                }
                .status-draft { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
                .status-final { background: #DCFCE7; color: #166534; border: 1px solid #86EFAC; }
            `}</style>

            {viewMode === "form" ? (
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                            <h1 className="text-xl font-bold text-[#183C30] flex items-center gap-2">
                                <FileText className="h-6 w-6" />
                                Gestión de Actas
                            </h1>
                            
                            <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
                                <button onClick={() => setViewTab("create")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewTab === 'create' ? 'bg-white shadow-sm text-[#183C30]' : 'text-gray-500 hover:text-gray-700'}`}>CREAR ACTA</button>
                                <button onClick={() => setViewTab("drafts")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewTab === 'drafts' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500 hover:text-gray-700'}`}>BORRADORES</button>
                                <button onClick={() => setViewTab("history")} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewTab === 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>HISTORIAL</button>
                            </div>

                            <button onClick={handleNewActa} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-red-500 shrink-0" title="Limpiar Formulario"><ArrowLeft className="h-5 w-5 rotate-45" /></button>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto justify-end">
                            {viewTab === 'create' && (
                                <>
                                    {status === "draft" && (
                                        <button onClick={() => handleSaveActa("draft")} disabled={isSaving} className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm text-sm"><Save className="h-4 w-4" />Guardar Borrador</button>
                                    )}
                                    <button onClick={handleGenerate} className="bg-[#183C30] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#122e24] transition-all flex items-center gap-2 shadow-sm text-sm"><FileText className="h-4 w-4" />Previsualizar</button>
                                </>
                            )}
                        </div>
                    </div>

                    {viewTab === 'create' ? (
                        <div className={`space-y-6 ${status === 'final' ? 'pointer-events-none opacity-75' : ''}`}>
                             <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block ${status === 'draft' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                MODO ACTUAL: {status === 'draft' ? 'BORRADOR (EDITABLE)' : 'CERRADA Y FIRMADA'}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                    <h3 className="font-bold text-gray-800 border-b pb-2">Configuración Básica</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Empresa</label>
                                            <select value={company} onChange={(e) => setCompany(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#183C30]/20">{companiesList.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                        </div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Consecutivo</label>
                                            <input type="text" value={consecutivo} onChange={(e) => setConsecutivo(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none font-bold" />
                                        </div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Período</label>
                                            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none">{AVAILABLE_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                                        </div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Fecha</label>
                                            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none" />
                                        </div>
                                    </div>
                                    <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Observaciones generales..." className="w-full border border-gray-200 rounded-lg p-2.5 text-sm min-h-[80px]" />
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Métricas Rápidas</h3>
                                    <div className="grid grid-cols-2 gap-4 flex-1">
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                            <p className="text-[9px] font-black text-blue-500 uppercase">Exactitud Unidades</p>
                                            <p className="text-2xl font-black text-blue-700">{exactitudUnidades.toFixed(1)}%</p>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                            <p className="text-[9px] font-black text-red-500 uppercase">Diferencias</p>
                                            <p className="text-2xl font-black text-red-700">{refConDiferencias} / {totalReferencias}</p>
                                        </div>
                                        <div className="col-span-2 bg-[#183C30] p-4 rounded-xl text-white">
                                            <p className="text-[9px] font-black text-emerald-300 uppercase">Deuda Detectada</p>
                                            <p className="text-xl font-black">${totalDeudaEmpaques.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-[#183C30] text-white text-[10px] uppercase font-black tracking-widest">
                                            <tr>
                                                <th className="p-4 w-[200px]">Referencia</th>
                                                <th className="p-4 text-center">Físico (C)</th>
                                                <th className="p-4 text-center">Libre (F)</th>
                                                <th className="p-4 text-center">B. Libre (S)</th>
                                                <th className="p-4 text-center">Sheets (L)</th>
                                                <th className="p-4 text-center">Total S.</th>
                                                <th className="p-4 text-center">Dif.</th>
                                                <th className="p-4">Justificación / Otros</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {items.map((item, idx) => {
                                                const p = processedItems[idx];
                                                if (p.s_total === 0 && p.p_total === 0 && item.physical === '') return null;
                                                return (
                                                    <tr key={item.sku} className="hover:bg-gray-50/50">
                                                        <td className="p-4">
                                                            <div className="flex flex-col"><span className="font-bold text-gray-800 text-xs">{item.sku}</span><span className="text-[9px] text-gray-400 truncate w-[160px]">{item.name}</span></div>
                                                        </td>
                                                        <td className="p-2"><input type="text" value={item.physical} onChange={(e) => updateItem(idx, 'physical', e.target.value)} className="w-full text-center p-1.5 border border-gray-200 rounded bg-gray-50/50 text-xs font-bold" /></td>
                                                        <td className="p-2"><input type="text" value={item.physicalFree} onChange={(e) => updateItem(idx, 'physicalFree', e.target.value)} className="w-full text-center p-1.5 border border-gray-200 rounded text-xs" /></td>
                                                        <td className="p-2"><input type="text" value={item.bLibre} onChange={(e) => updateItem(idx, 'bLibre', e.target.value)} className="w-full text-center p-1.5 border border-gray-200 rounded text-xs" /></td>
                                                        <td className="p-2"><input type="text" value={item.systemFree} onChange={(e) => updateItem(idx, 'systemFree', e.target.value)} className="w-full text-center p-1.5 border border-gray-200 rounded text-xs" /></td>
                                                        <td className="p-4 text-center font-black text-gray-400 text-xs">{p.s_total}</td>
                                                        <td className={`p-4 text-center font-black text-xs ${p.diff < 0 ? 'text-red-600' : p.diff > 0 ? 'text-blue-600' : 'text-green-600'}`}>{p.diff}</td>
                                                        <td className="p-2">
                                                            <div className="flex gap-1 mb-1">
                                                                <input type="text" value={item.bTransito} onChange={(e) => updateItem(idx, 'bTransito', e.target.value)} className="w-8 border border-gray-100 rounded text-[9px] p-1 text-center" placeholder="T" />
                                                                <input type="text" value={item.bPerdida} onChange={(e) => updateItem(idx, 'bPerdida', e.target.value)} className="w-8 border border-gray-100 rounded text-[9px] p-1 text-center" placeholder="P" />
                                                                <input type="text" value={item.bDos} onChange={(e) => updateItem(idx, 'bDos', e.target.value)} className="w-8 border border-gray-100 rounded text-[9px] p-1 text-center" placeholder="B2" />
                                                            </div>
                                                            <input type="text" value={item.justificacion} onChange={(e) => updateItem(idx, 'justificacion', e.target.value)} className="w-full border-b border-gray-100 p-1 text-[9px] italic outline-none" placeholder="Explicación..." />
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
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[600px]">
                            <div className="flex justify-between items-center mb-10">
                                <h3 className="text-xl font-black uppercase tracking-widest text-[#183C30] flex items-center gap-3">
                                    <History className="h-6 w-6" /> {viewTab === 'drafts' ? 'Borradores en Curso' : 'Repositorio Histórico'}
                                </h3>
                                <button onClick={fetchActas} className="px-5 py-2.5 bg-[#183C30] text-white rounded-xl text-xs font-black shadow-lg hover:rotate-2 transition-all">Sincronizar</button>
                            </div>

                            {isLoadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-40 gap-4"><div className="w-12 h-12 border-4 border-gray-100 border-t-[#183C30] rounded-full animate-spin"></div><p className="text-xs font-black text-gray-300 uppercase tracking-widest">Consultando Nube...</p></div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {savedActas?.filter(a => viewTab === 'drafts' ? a?.status === 'draft' : a?.status === 'final').slice().reverse().map(acta => (
                                        <div key={acta?.id || Math.random()} onClick={() => handleLoadActa(acta)} className={`group relative p-8 bg-white rounded-[2rem] border-2 transition-all cursor-pointer shadow-sm hover:shadow-2xl hover:-translate-y-1 ${viewTab === 'drafts' ? 'border-amber-50 hover:border-amber-300' : 'border-blue-50 hover:border-blue-400'}`}>
                                            <div className="flex justify-between mb-6">
                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${acta?.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{acta?.status === 'draft' ? 'Draft' : 'Final'}</span>
                                            </div>
                                            <h4 className="text-lg font-black text-gray-900 leading-tight uppercase line-clamp-2 mb-2">{acta?.data?.company || 'Sin Empresa'}</h4>
                                            <div className="flex flex-col gap-2 mb-8">
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-bold"><Calendar className="h-4 w-4 text-gray-300" />{acta?.data?.periodo || 'Sin Periodo'}</div>
                                                <div className="flex items-center gap-2 text-[10px] text-gray-400"><FileText className="h-4 w-4 text-gray-200" />Doc: {acta?.data?.consecutivo || 'S/C'}</div>
                                            </div>
                                            <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                                                <span className="text-[10px] font-bold text-gray-300">{acta?.date ? new Date(acta.date).toLocaleDateString() : 'Sin Fecha'}</span>
                                                <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-[#183C30] group-hover:text-white transition-all"><ArrowLeft className="h-4 w-4 rotate-180" /></div>
                                            </div>
                                        </div>
                                    ))}
                                    {savedActas.filter(a => viewTab === 'drafts' ? a.status === 'draft' : a.status === 'final').length === 0 && (
                                        <div className="col-span-full py-40 border-4 border-dashed border-gray-100 rounded-[3rem] text-center"><FileText className="h-12 w-12 text-gray-200 mx-auto mb-4" /><p className="text-gray-300 font-black uppercase text-xs tracking-widest">No se detectaron registros</p></div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="max-w-[800px] mx-auto pb-20 no-print animate-in fade-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-white mb-8 sticky top-4 z-50">
                        <button onClick={() => setViewMode("form")} className="flex items-center gap-2 text-xs font-black bg-gray-100 px-6 py-3 rounded-2xl hover:bg-gray-200 transition-all text-gray-600"><ArrowLeft className="h-4 w-4" />EDITOR</button>
                        <div className="flex gap-2">
                            <button onClick={handlePrint} className="bg-gray-800 text-white px-5 py-3 rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg"><Printer className="h-4 w-4" />IMPRIMIR</button>
                            <button onClick={handleDownloadPDF} className="bg-[#183C30] text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"><Download className="h-4 w-4" />DESCARGAR PDF</button>
                        </div>
                    </div>

                    <div ref={printRef} className="print-section bg-white shadow-2xl relative overflow-hidden" style={{ minHeight: '1120px' }}>
                        {status === 'draft' && <div className="watermark">Draft</div>}
                        <div className={`status-badge ${status === 'draft' ? 'status-draft' : 'status-final'}`}>{status === 'draft' ? 'Borrador Oficial' : 'Cerrada y Firmada'}</div>

                        <div className="flex justify-between items-start mb-10 border-b-4 border-[#183C30] pb-8">
                            <div>
                                <div className="bg-[#183C30] text-white px-5 py-2 rounded-xl mb-4 inline-block font-black text-xs tracking-widest">ACTA DE CIERRE</div>
                                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">{company}</h2>
                                <p className="text-xs font-bold text-gray-400 italic">Conciliación de Inventarios y Diferencias de Bodega</p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                                <span className="text-[9px] font-black text-gray-300 uppercase">Documento ID</span>
                                <p className="text-xs font-black text-[#183C30] font-mono">{consecutivo}</p>
                                <p className="text-xs font-bold">{fecha} · {periodo.toUpperCase()}</p>
                            </div>
                        </div>

                        <div className="bg-[#183C30]/5 border border-[#183C30]/10 p-6 rounded-2xl mb-10">
                            <h4 className="font-black text-[#183C30] text-[10px] uppercase tracking-widest mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Alcance Operativo</h4>
                            <p className="text-justify text-[11px] leading-relaxed text-gray-800 font-medium">Este documento certifica el conteo de <strong>{periodo}</strong> en <strong>{company}</strong> operado por EMPAQUES Y SOLUCIONES. Los faltantes reportados sirven como base para cobros administrativos, garantizando transparencia contable.</p>
                        </div>

                        <div className="space-y-10">
                            <div>
                                <h3 className="font-black text-xs uppercase text-[#183C30] mb-4 border-b border-gray-100 pb-2">1. Resumen de Hallazgos</h3>
                                <table className="w-full border-collapse text-center text-[9px]">
                                    <thead className="bg-[#183C30] text-white">
                                        <tr>
                                            <th className="p-2 text-left">Referencia</th>
                                            <th className="p-2">Sist. (B)</th>
                                            <th className="p-2">Libres (S)</th>
                                            <th className="p-2 font-black bg-[#132f26]">Total S.</th>
                                            <th className="p-2">Físico (C)</th>
                                            <th className="p-2">Libres (F)</th>
                                            <th className="p-2 font-black bg-[#132f26]">Total F.</th>
                                            <th className="p-2">Dif.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {displayComparisonItems.map(i => (
                                            <tr key={i.sku}>
                                                <td className="p-2 text-left font-bold">{i.sku} - {i.name}</td>
                                                <td className="p-2">{i.s}</td>
                                                <td className="p-2">{i.s_free}</td>
                                                <td className="p-2 font-black bg-gray-50">{i.s_total}</td>
                                                <td className="p-2">{i.p}</td>
                                                <td className="p-2">{i.p_free}</td>
                                                <td className="p-2 font-black bg-gray-50">{i.p_total}</td>
                                                <td className={`p-2 font-black ${i.diff < 0 ? 'text-red-700' : 'text-blue-700'}`}>{i.diff}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ pageBreakInside: 'avoid' }}>
                                <h3 className="font-black text-xs uppercase text-[#183C30] mb-4 border-b border-gray-100 pb-2">2. Novedades y Justificaciones</h3>
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="bg-red-50 p-5 rounded-2xl border border-red-100">
                                        <h4 className="font-black text-[9px] text-red-600 uppercase mb-3">Faltantes Críticos</h4>
                                        <ul className="space-y-1 text-[9px] text-red-900 font-bold">
                                            {itemsFaltantes.slice(0, 10).map(i => <li key={i.sku}>· {i.sku}: {Math.abs(i.diff)} und.</li>)}
                                        </ul>
                                    </div>
                                    <div className="bg-[#183C30]/5 p-5 rounded-2xl border border-[#183C30]/10">
                                        <h4 className="font-black text-[9px] text-[#183C30] uppercase mb-3">Resumen de Cobros</h4>
                                        <p className="text-xl font-black text-[#183C30] mb-2">${totalDeudaEmpaques.toLocaleString()}</p>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase italic">Valor total estimado a cobro administrativo por proveedor.</p>
                                    </div>
                                </div>
                            </div>

                            {observaciones.trim() !== "" && (
                                <div style={{ pageBreakInside: 'avoid' }} className="p-6 bg-gray-50 rounded-2xl border border-gray-200 text-[10px] italic leading-relaxed shadow-inner">
                                    <strong className="text-[#183C30] uppercase not-italic mb-2 block">Dictamen del Auditor:</strong>
                                    {observaciones}
                                </div>
                            )}

                            <div className="mt-24" style={{ pageBreakInside: 'avoid' }}>
                                <div className="grid grid-cols-3 gap-10">
                                    <div className="text-center"><div className="border-b-2 border-gray-900 mb-2 w-44 mx-auto"></div><p className="font-black uppercase text-[8px] text-gray-400">Responsable Inventarios</p></div>
                                    <div className="text-center"><div className="border-b-2 border-gray-900 mb-2 w-44 mx-auto"></div><p className="font-black uppercase text-[8px] text-gray-400">Auditor de Calidad</p></div>
                                    <div className="text-center"><div className="border-b-2 border-gray-900 mb-2 w-44 mx-auto"></div><p className="font-black uppercase text-[8px] text-gray-400">Representante Legal</p></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


