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
    date.setMonth(date.getMonth() - 6);
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
    bPrincipal: number | '';
    bAverias: number | '';
    bComercExt: number | '';
    bLibre: number | '';
    bTransito: number | '';
    bPerdida: number | '';
    bDos: number | '';
    justificacion: string;
    physicalFree: number | '';
    systemFree: number | '';
    system: number | '';
    unitPrice: number | '';
}

export default function CierreActasPage() {
    const { data: inventoryData } = useInventory();
    const [viewMode, setViewMode] = useState<"form" | "document">("form");
    const [viewTab, setViewTab] = useState<"create" | "drafts" | "history">("create");
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
    const [items, setItems] = useState<ActaItem[]>(
        SALES_CODES.map(sku => ({
            sku,
            name: DEFAULT_PRODUCT_NAMES[sku] || `Producto ${sku}`,
            physical: '', bPrincipal: '', bAverias: '', bComercExt: '', bLibre: '', bTransito: '', bPerdida: '', bDos: '', justificacion: '', system: '', unitPrice: '', physicalFree: '', systemFree: ''
        }))
    );

    useEffect(() => {
        if (inventoryData && inventoryData.length > 0) {
            const uniqueCompanies = Array.from(new Set(inventoryData.map((d: any) => d.company || d.company_name))).filter(Boolean) as string[];
            if (uniqueCompanies.length > 0) {
                setCompaniesList(uniqueCompanies.sort());
                if (!uniqueCompanies.includes(company)) setCompany(uniqueCompanies[0]);
            }
            const realNamesMap: Record<string, string> = {};
            inventoryData.forEach((d: any) => { if (d.code && d.name) realNamesMap[d.code] = d.name; });
            setItems(prev => prev.map(item => ({ ...item, name: realNamesMap[item.sku] || item.name })));
        }
    }, [inventoryData]);

    const fetchActas = async () => {
        setIsLoadingHistory(true);
        try {
            const response = await axios.get(`${API_URL}/inventory/actas`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("gco_token")}` }
            });
            setSavedActas(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error("Error fetching actas:", error);
            setSavedActas([]);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => { fetchActas(); }, []);

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
        toast.success(`Acta cargada correctamente`);
    };

    const handleNewActa = () => {
        setActaId(null);
        setStatus("draft");
        setObservaciones("");
        const newItems = SALES_CODES.map(sku => ({
            sku,
            name: DEFAULT_PRODUCT_NAMES[sku] || `Producto ${sku}`,
            physical: '', bPrincipal: '', bAverias: '', bComercExt: '', bLibre: '', bTransito: '', bPerdida: '', bDos: '', justificacion: '', system: '', unitPrice: '', physicalFree: '', systemFree: ''
        }));
        if (inventoryData) {
            const realNamesMap: Record<string, string> = {};
            inventoryData.forEach((d: any) => { if (d.code && d.name) realNamesMap[d.code] = d.name; });
            setItems(newItems.map(i => ({ ...i, name: realNamesMap[i.sku] || i.name })));
        } else {
            setItems(newItems);
        }
        setViewTab("create");
        toast.info("Nuevo formulario listo");
    };

    const updateItem = (index: number, field: keyof ActaItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const processedItems = useMemo(() => items.map(i => {
        const s_base = (Number(i.bPrincipal) || 0) + (Number(i.bAverias) || 0) + (Number(i.bComercExt) || 0) + (Number(i.bLibre) || 0);
        const s_free = Number(i.systemFree) || 0;
        const p_base = Number(i.physical) || 0;
        const p_free = Number(i.physicalFree) || 0;
        return {
            ...i,
            s: s_base,
            s_free,
            s_total: s_base + s_free,
            p: p_base,
            p_free,
            p_total: p_base + p_free,
            diff: (p_base + p_free) - (s_base + s_free),
            bTr: Number(i.bTransito) || 0,
            bPer: Number(i.bPerdida) || 0,
            bD: Number(i.bDos) || 0
        };
    }), [items]);

    const totalUnidadesSistema = useMemo(() => processedItems.reduce((sum, i) => sum + i.s_total, 0), [processedItems]);
    const totalUnidadesDiferencia = useMemo(() => processedItems.reduce((sum, i) => sum + Math.abs(i.diff), 0), [processedItems]);
    const refConDiferencias = useMemo(() => processedItems.filter(i => (i.physical !== '' || i.physicalFree !== '') && i.diff !== 0).length, [processedItems]);
    const totalReferencias = useMemo(() => processedItems.filter(i => (i.physical !== '' || i.physicalFree !== '') || i.s_total > 0).length, [processedItems]);
    const exactitudUnidades = useMemo(() => totalUnidadesSistema > 0 ? (1 - (totalUnidadesDiferencia / (totalUnidadesSistema + totalUnidadesDiferencia))) * 100 : 100, [totalUnidadesSistema, totalUnidadesDiferencia]);
    const totalDeudaEmpaques = useMemo(() => processedItems.filter(i => i.diff < 0).reduce((sum, i) => sum + (Math.abs(i.diff) * (Number(i.unitPrice) || 0)), 0), [processedItems]);

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
            toast.success(newStatus === 'final' ? "Cerrada exitosamente" : "Borrador guardado");
            fetchActas();
        } catch (error) { toast.error("Error al guardar"); } finally { setIsSaving(false); }
    };

    const printRef = useRef<HTMLDivElement>(null);
    const handleDownloadPDF = async () => {
        if (!printRef.current) return;
        const toastId = toast.loading("Generando PDF...");
        try {
            const canvas = await html2canvas(printRef.current, { scale: 1.5, useCORS: true, backgroundColor: "#ffffff", windowWidth: 800 });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            const iw = canvas.width;
            const ih = canvas.height;
            const ratio = pw / iw;
            const rh = ih * ratio;
            pdf.addImage(imgData, 'PNG', 0, 10, pw, rh);
            pdf.save(`Acta_${company.split(' ')[0]}_${periodo}.pdf`);
            toast.success("PDF generado", { id: toastId });
        } catch (e) { toast.error("Error PDF", { id: toastId }); }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20 pt-10">
            <style jsx global>{`
                @media print { .no-print { display: none !important; } .print-section { padding: 20mm !important; } }
                .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 15rem; font-weight: 900; color: rgba(0,0,0,0.03); pointer-events: none; z-index: 0; white-space: nowrap; text-transform: uppercase; }
                .status-badge { position: absolute; top: 2rem; right: 2rem; padding: 0.5rem 1rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 900; z-index: 10; }
                .status-draft { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
                .status-final { background: #DCFCE7; color: #166534; border: 1px solid #86EFAC; }
            `}</style>

            {viewMode === "form" ? (
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <h1 className="text-xl font-bold text-[#183C30] flex items-center gap-2"><FileText className="h-6 w-6" /> Gestión de Actas</h1>
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                <button onClick={() => setViewTab("create")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewTab === 'create' ? 'bg-white shadow-sm text-[#183C30]' : 'text-gray-500'}`}>CREAR ACTA</button>
                                <button onClick={() => setViewTab("drafts")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewTab === 'drafts' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>BORRADORES</button>
                                <button onClick={() => setViewTab("history")} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewTab === 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>HISTORIAL</button>
                            </div>
                            <button onClick={handleNewActa} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><ArrowLeft className="h-5 w-5 rotate-45" /></button>
                        </div>
                        <div className="flex gap-2">
                            {viewTab === 'create' && (
                                <>
                                    {status === "draft" && <button onClick={() => handleSaveActa("draft")} disabled={isSaving} className="bg-white border text-gray-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm"><Save className="h-4 w-4" />Guardar Borrador</button>}
                                    <button onClick={() => setViewMode("document")} className="bg-[#183C30] text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm"><FileText className="h-4 w-4" />Previsualizar</button>
                                </>
                            )}
                        </div>
                    </div>

                    {viewTab === 'create' ? (
                        <div className={`space-y-6 ${status === 'final' ? 'pointer-events-none opacity-75' : ''}`}>
                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase ${status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                MODO ACTUAL: {status === 'draft' ? 'BORRADOR' : 'CIERRE FINAL'}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                                    <h3 className="font-bold text-gray-800 border-b pb-2 text-sm uppercase">Configuración</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Empresa</label>
                                            <select value={company} onChange={(e) => setCompany(e.target.value)} className="w-full border rounded-lg p-2 text-sm">{companiesList.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                        </div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Consecutivo</label>
                                            <input type="text" value={consecutivo} onChange={(e) => setConsecutivo(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-bold" />
                                        </div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Período</label>
                                            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-full border rounded-lg p-2 text-sm">{AVAILABLE_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                                        </div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Fecha</label>
                                            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                                        </div>
                                    </div>
                                    <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas..." className="w-full border rounded-lg p-2 text-sm min-h-[60px]" />
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col justify-between">
                                    <h3 className="font-bold text-gray-800 border-b pb-2 text-sm uppercase">Métricas</h3>
                                    <div className="grid grid-cols-2 gap-4 flex-1 mt-4">
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                            <p className="text-[9px] font-black text-blue-500 uppercase">Exactitud</p>
                                            <p className="text-2xl font-black text-blue-700">{exactitudUnidades.toFixed(1)}%</p>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                            <p className="text-[9px] font-black text-red-500 uppercase">Difs.</p>
                                            <p className="text-2xl font-black text-red-700">{refConDiferencias}</p>
                                        </div>
                                        <div className="col-span-2 bg-[#183C30] p-4 rounded-xl text-white">
                                            <p className="text-[9px] font-black text-emerald-300 uppercase">Deuda Detectada</p>
                                            <p className="text-xl font-black">${totalDeudaEmpaques.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-[#183C30] text-white text-[9px] uppercase font-black">
                                            <tr>
                                                <th className="p-3">SKU / Producto</th>
                                                <th className="p-3 text-center">Físico (C)</th>
                                                <th className="p-3 text-center">Libre (F)</th>
                                                <th className="p-3 text-center bg-[#132f26]">B. Princ</th>
                                                <th className="p-3 text-center bg-[#132f26]">B. Averia</th>
                                                <th className="p-3 text-center bg-[#132f26]">B. C.Ext</th>
                                                <th className="p-3 text-center bg-[#132f26]">B. Libre (S)</th>
                                                <th className="p-3 text-center">Sheets (L)</th>
                                                <th className="p-3 text-center font-bold">Total S.</th>
                                                <th className="p-3 text-center">Dif.</th>
                                                <th className="p-3">P. Unit.</th>
                                                <th className="p-3">Justificación</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {items.map((item, idx) => {
                                                const p = processedItems[idx];
                                                const isEssential = SALES_CODES.includes(item.sku);
                                                const hasData = p.s_total > 0 || p.p_total > 0 || item.physical !== '';
                                                if (!isEssential && !hasData) return null;
                                                return (
                                                    <tr key={item.sku} className="hover:bg-gray-50/50">
                                                        <td className="p-2">
                                                            <div className="flex flex-col"><span className="font-bold text-gray-800 text-[10px]">{item.sku}</span><span className="text-[9px] text-gray-400 truncate w-[140px]">{item.name}</span></div>
                                                        </td>
                                                        <td className="p-1"><input type="text" value={item.physical} onChange={(e) => updateItem(idx, 'physical', e.target.value)} className="w-14 text-center p-1 border rounded text-[10px] font-bold" /></td>
                                                        <td className="p-1"><input type="text" value={item.physicalFree} onChange={(e) => updateItem(idx, 'physicalFree', e.target.value)} className="w-10 text-center p-1 border rounded text-[10px]" /></td>
                                                        <td className="p-1 bg-gray-50/50"><input type="text" value={item.bPrincipal} onChange={(e) => updateItem(idx, 'bPrincipal', e.target.value)} className="w-10 text-center p-1 border rounded text-[10px]" /></td>
                                                        <td className="p-1 bg-gray-50/50"><input type="text" value={item.bAverias} onChange={(e) => updateItem(idx, 'bAverias', e.target.value)} className="w-10 text-center p-1 border rounded text-[10px]" /></td>
                                                        <td className="p-1 bg-gray-50/50"><input type="text" value={item.bComercExt} onChange={(e) => updateItem(idx, 'bComercExt', e.target.value)} className="w-10 text-center p-1 border rounded text-[10px]" /></td>
                                                        <td className="p-1 bg-gray-50/50"><input type="text" value={item.bLibre} onChange={(e) => updateItem(idx, 'bLibre', e.target.value)} className="w-10 text-center p-1 border rounded text-[10px]" /></td>
                                                        <td className="p-1"><input type="text" value={item.systemFree} onChange={(e) => updateItem(idx, 'systemFree', e.target.value)} className="w-10 text-center p-1 border rounded text-[10px]" /></td>
                                                        <td className="p-2 text-center font-bold text-[10px] text-gray-400">{p.s_total}</td>
                                                        <td className={`p-2 text-center font-bold text-[10px] ${p.diff < 0 ? 'text-red-600' : 'text-blue-600'}`}>{p.diff}</td>
                                                        <td className="p-1"><input type="text" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} className="w-20 p-1 border rounded text-[10px]" placeholder="$0" /></td>
                                                        <td className="p-1"><input type="text" value={item.justificacion} onChange={(e) => updateItem(idx, 'justificacion', e.target.value)} className="w-full border-b p-1 text-[9px] outline-none" placeholder="..." /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white p-8 rounded-3xl shadow-sm border min-h-[500px]">
                            <h3 className="text-xl font-black uppercase mb-10 text-[#183C30] flex items-center gap-3"><History className="h-6 w-6" /> {viewTab === 'drafts' ? 'Borradores' : 'Historial'}</h3>
                            {isLoadingHistory ? <div className="text-center py-20 text-gray-300 font-bold">CARGANDO...</div> : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {(Array.isArray(savedActas) ? savedActas : []).filter(a => viewTab === 'drafts' ? a?.status === 'draft' : a?.status === 'final').slice().reverse().map(acta => (
                                        <div key={acta?.id} onClick={() => handleLoadActa(acta)} className="p-6 bg-white rounded-2xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-lg">
                                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${acta?.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{acta?.status}</span>
                                            <h4 className="text-sm font-black mt-4 uppercase line-clamp-1">{acta?.data?.company}</h4>
                                            <p className="text-[10px] text-gray-500 font-bold mt-1">{acta?.data?.periodo}</p>
                                            <div className="flex items-center justify-between mt-6 pt-4 border-t">
                                                <span className="text-[9px] font-bold text-gray-300">{acta?.date ? new Date(acta.date).toLocaleDateString() : ''}</span>
                                                <ArrowLeft className="h-4 w-4 rotate-180" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="max-w-[800px] mx-auto pb-20 no-print animate-in fade-in">
                    <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-xl mb-8 sticky top-4 z-50">
                        <button onClick={() => setViewMode("form")} className="flex items-center gap-2 text-xs font-black bg-gray-100 px-5 py-3 rounded-xl">REGRESAR</button>
                        <div className="flex gap-2"><button onClick={() => window.print()} className="bg-gray-800 text-white px-5 py-3 rounded-xl text-xs font-black">IMPRIMIR</button><button onClick={handleDownloadPDF} className="bg-[#183C30] text-white px-6 py-3 rounded-xl text-xs font-black">PDF</button></div>
                    </div>
                    <div ref={printRef} className="print-section bg-white shadow-2xl relative overflow-hidden p-12" style={{ minHeight: '1120px' }}>
                        {status === 'draft' && <div className="watermark">Draft</div>}
                        <div className="flex justify-between mb-10 border-b-4 border-[#183C30] pb-6">
                            <div><h2 className="text-2xl font-black text-gray-900 uppercase">ACTA DE INVENTARIO</h2><p className="text-xl font-bold text-gray-600">{company}</p></div>
                            <div className="text-right text-xs font-bold text-gray-400"><p>{consecutivo}</p><p>{fecha}</p><p>{periodo}</p></div>
                        </div>
                        <div className="space-y-10">
                            <div>
                                <h3 className="font-black text-xs uppercase text-[#183C30] mb-4 border-b">1. Conteo Físico</h3>
                                <table className="w-full text-center text-[9px] border-collapse">
                                    <thead className="bg-[#183C30] text-white"><tr><th className="p-2 text-left">SKU - Producto</th><th className="p-2">Sist.</th><th className="p-2">Físico</th><th className="p-2">Dif.</th></tr></thead>
                                    <tbody className="divide-y">
                                        {processedItems.filter(i => i.s_total > 0 || i.p_total > 0).map(i => (
                                            <tr key={i.sku}><td className="p-2 text-left font-bold">{i.sku} - {i.name}</td><td className="p-2">{i.s_total}</td><td className="p-2">{i.p_total}</td><td className={`p-2 font-black ${i.diff < 0 ? 'text-red-700' : 'text-blue-700'}`}>{i.diff}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-20 grid grid-cols-3 gap-10">
                                <div className="text-center border-t-2 border-gray-900 pt-2"><p className="font-black uppercase text-[8px] text-gray-400">Responsable</p></div>
                                <div className="text-center border-t-2 border-gray-900 pt-2"><p className="font-black uppercase text-[8px] text-gray-400">Auditor</p></div>
                                <div className="text-center border-t-2 border-gray-900 pt-2"><p className="font-black uppercase text-[8px] text-gray-400">Gerencia</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
