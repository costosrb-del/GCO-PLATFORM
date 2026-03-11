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
    bCustodia: number | '';
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
            physical: '', bPrincipal: '', bAverias: '', bComercExt: '', bLibre: '', bTransito: '', bPerdida: '', bDos: '', bCustodia: '', justificacion: '', system: '', unitPrice: '', physicalFree: '', systemFree: ''
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
        toast.success(`Acta cargada`);
    };

    const handleNewActa = () => {
        setActaId(null);
        setStatus("draft");
        setObservaciones("");
        const newItems: ActaItem[] = SALES_CODES.map(sku => ({
            sku,
            name: DEFAULT_PRODUCT_NAMES[sku] || `Producto ${sku}`,
            physical: '', bPrincipal: '', bAverias: '', bComercExt: '', bLibre: '', bTransito: '', bPerdida: '', bDos: '', bCustodia: '', justificacion: '', system: '', unitPrice: '', physicalFree: '', systemFree: ''
        }));
        if (inventoryData) {
            const realNamesMap: Record<string, string> = {};
            inventoryData.forEach((d: any) => { if (d.code && d.name) realNamesMap[d.code] = d.name; });
            setItems(newItems.map(i => ({ ...i, name: realNamesMap[i.sku] || i.name })));
        } else {
            setItems(newItems);
        }
        setViewTab("create");
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
            bD: Number(i.bDos) || 0,
            bCus: Number(i.bCustodia) || 0,
            bComExt: Number(i.bComercExt) || 0
        };
    }), [items]);

    const totalUnidadesSistema = useMemo(() => processedItems.reduce((sum, i) => sum + i.s_total, 0), [processedItems]);
    const totalUnidadesDiferencia = useMemo(() => processedItems.reduce((sum, i) => sum + Math.abs(i.diff), 0), [processedItems]);
    const refConDiferencias = useMemo(() => processedItems.filter(i => (i.physical !== '' || i.physicalFree !== '') && i.diff !== 0).length, [processedItems]);
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
            toast.success(newStatus === 'final' ? "Cerrada" : "Borrador guardado");
            fetchActas();
        } catch (error) { toast.error("Error al guardar"); } finally { setIsSaving(false); }
    };

    const printRef = useRef<HTMLDivElement>(null);
    const handleDownloadPDF = async () => {
        if (!printRef.current) return;
        const toastId = toast.loading("Generando PDF Profesional...");
        try {
            const element = printRef.current;
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: "#ffffff",
                logging: false,
                windowWidth: element.scrollWidth
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            const iw = canvas.width;
            const ih = canvas.height;
            const ratio = pw / iw;
            const rh = ih * ratio;
            
            let heightLeft = rh;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pw, rh);
            heightLeft -= ph;

            while (heightLeft >= 0) {
                position = heightLeft - rh;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pw, rh);
                heightLeft -= ph;
            }

            pdf.save(`Acta_Cierre_${company.replace(/ /g, '_')}_${periodo}.pdf`);
            toast.success("Descarga completada", { id: toastId });
        } catch (e) { 
            console.error(e);
            toast.error("Fallo al generar PDF", { id: toastId }); 
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20 pt-10">
            <style jsx global>{`
                @media print { .no-print { display: none !important; } .print-section { padding: 0 !important; margin: 0 !important; width: 100% !important; } }
                .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 15rem; font-weight: 900; color: rgba(0,0,0,0.03); pointer-events: none; z-index: 0; white-space: nowrap; text-transform: uppercase; }
                .status-badge { position: absolute; top: 2rem; right: 2rem; padding: 0.5rem 1rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 900; z-index: 10; border: 2px solid; }
                .status-draft { background: #FFFBEB; color: #92400E; border-color: #FCD34D; }
                .status-final { background: #F0FDF4; color: #166534; border-color: #86EFAC; }
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
                            <button onClick={handleNewActa} className="p-2 hover:bg-gray-100 rounded-full text-gray-400" title="Limpiar"><ArrowLeft className="h-5 w-5 rotate-45" /></button>
                        </div>
                        <div className="flex gap-2">
                            {viewTab === 'create' && (
                                <>
                                    {status === "draft" && <button onClick={() => handleSaveActa("draft")} disabled={isSaving} className="bg-white border text-gray-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-gray-50 transition-all"><Save className="h-4 w-4" />Guardar Borrador</button>}
                                    <button onClick={() => setViewMode("document")} className="bg-[#183C30] text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-[#122e24] transition-all"><FileText className="h-4 w-4" />Previsualizar</button>
                                </>
                            )}
                        </div>
                    </div>

                    {viewTab === 'create' ? (
                        <div className={`space-y-6 ${status === 'final' ? 'pointer-events-none opacity-75' : ''}`}>
                             <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block ${status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                MODO: {status === 'draft' ? 'EDITABLE' : 'CERRADA'}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                                    <h3 className="font-bold text-gray-800 border-b pb-2 text-sm uppercase">Configuración de Acta</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Empresa Responsable</label>
                                            <select value={company} onChange={(e) => setCompany(e.target.value)} className="w-full border rounded-lg p-2 text-sm">{companiesList.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                        </div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Número Consecutivo</label>
                                            <input type="text" value={consecutivo} onChange={(e) => setConsecutivo(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-bold" />
                                        </div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Período Fiscal</label>
                                            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-full border rounded-lg p-2 text-sm">{AVAILABLE_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                                        </div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 uppercase">Fecha de Cierre</label>
                                            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                                        </div>
                                    </div>
                                    <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Dictamen del auditor y observaciones finales..." className="w-full border rounded-lg p-3 text-sm min-h-[80px]" />
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col">
                                    <h3 className="font-bold text-gray-800 border-b pb-2 text-sm uppercase mb-4">Métricas del Conteo</h3>
                                    <div className="grid grid-cols-2 gap-4 flex-1">
                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col justify-center">
                                            <p className="text-[9px] font-black text-blue-500 uppercase">Exactitud</p>
                                            <p className="text-2xl font-black text-[#183C30]">{exactitudUnidades.toFixed(1)}%</p>
                                        </div>
                                        <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 flex flex-col justify-center">
                                            <p className="text-[9px] font-black text-red-500 uppercase">Diferencias</p>
                                            <p className="text-2xl font-black text-red-700">{refConDiferencias}</p>
                                        </div>
                                        <div className="col-span-2 bg-[#183C30] p-4 rounded-xl text-white flex justify-between items-center">
                                            <div>
                                                <p className="text-[9px] font-black text-emerald-300 uppercase">Valor Deuda (Faltantes)</p>
                                                <p className="text-xl font-black">${totalDeudaEmpaques.toLocaleString()}</p>
                                            </div>
                                            <AlertTriangle className="h-8 w-8 text-emerald-300 opacity-50" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Matriz de Conciliación</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-[#183C30] text-white text-[9px] uppercase font-black">
                                            <tr>
                                                <th className="p-4">Referencia / Producto</th>
                                                <th className="p-2 text-center">Físico (C)</th>
                                                <th className="p-2 text-center">Libre (F)</th>
                                                <th className="p-2 text-center bg-[#132f26]">Bodega Principal</th>
                                                <th className="p-2 text-center bg-[#132f26]">Bodega Avería</th>
                                                <th className="p-2 text-center bg-[#132f26]">Comercio Ext.</th>
                                                <th className="p-2 text-center bg-gray-500/20">Custodia (@)</th>
                                                <th className="p-2 text-center bg-amber-950/20">Bodega Tránsito</th>
                                                <th className="p-2 text-center bg-red-950/20">Bodega Pérdida</th>
                                                <th className="p-2 text-center">Sheets (L)</th>
                                                <th className="p-2 text-center font-bold">Total Sistema</th>
                                                <th className="p-2 text-center">Diferencia</th>
                                                <th className="p-2">$$ Unit.</th>
                                                <th className="p-2">Justificación</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {items.map((item, idx) => {
                                                const p = processedItems[idx];
                                                const isEssential = SALES_CODES.includes(item.sku);
                                                const hasData = p.s_total > 0 || p.p_total > 0 || item.physical !== '' || p.bTr > 0 || p.bPer > 0;
                                                if (!isEssential && !hasData) return null;
                                                return (
                                                    <tr key={item.sku} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="p-2">
                                                            <div className="flex flex-col"><span className="font-bold text-gray-800 text-[11px]">{item.sku}</span><span className="text-[9px] text-gray-400 truncate w-[140px] leading-none">{item.name}</span></div>
                                                        </td>
                                                        <td className="p-1"><input type="text" value={item.physical} onChange={(e) => updateItem(idx, 'physical', e.target.value)} className="w-14 text-center p-1.5 border rounded-lg text-[10px] font-bold bg-gray-50/50 focus:bg-white" /></td>
                                                        <td className="p-1"><input type="text" value={item.physicalFree} onChange={(e) => updateItem(idx, 'physicalFree', e.target.value)} className="w-10 text-center p-1.5 border rounded-lg text-[10px]" /></td>
                                                        <td className="p-1 bg-gray-50/30"><input type="text" value={item.bPrincipal} onChange={(e) => updateItem(idx, 'bPrincipal', e.target.value)} className="w-10 text-center p-1.5 border rounded-lg text-[10px]" /></td>
                                                        <td className="p-1 bg-gray-50/30"><input type="text" value={item.bAverias} onChange={(e) => updateItem(idx, 'bAverias', e.target.value)} className="w-10 text-center p-1.5 border rounded-lg text-[10px]" /></td>
                                                        <td className="p-1 bg-gray-50/30"><input type="text" value={item.bComercExt} onChange={(e) => updateItem(idx, 'bComercExt', e.target.value)} className="w-10 text-center p-1.5 border rounded-lg text-[10px]" /></td>
                                                        <td className="p-1 bg-gray-100/50"><input type="text" value={item.bCustodia} onChange={(e) => updateItem(idx, 'bCustodia', e.target.value)} className="w-10 text-center p-1.5 border rounded-lg text-[10px] text-gray-500" placeholder="@" /></td>
                                                        <td className="p-1 bg-amber-50/30"><input type="text" value={item.bTransito} onChange={(e) => updateItem(idx, 'bTransito', e.target.value)} className="w-10 text-center p-1.5 border rounded-lg text-[10px] text-amber-700 font-bold" placeholder="T" /></td>
                                                        <td className="p-1 bg-red-50/30"><input type="text" value={item.bPerdida} onChange={(e) => updateItem(idx, 'bPerdida', e.target.value)} className="w-10 text-center p-1.5 border rounded-lg text-[10px] text-red-700 font-bold" placeholder="P" /></td>
                                                        <td className="p-1"><input type="text" value={item.systemFree} onChange={(e) => updateItem(idx, 'systemFree', e.target.value)} className="w-10 text-center p-1.5 border rounded-lg text-[10px]" /></td>
                                                        <td className="p-2 text-center font-bold text-[11px] text-gray-400">{p.s_total}</td>
                                                        <td className={`p-2 text-center font-black text-[11px] ${p.diff < 0 ? 'text-red-600' : p.diff > 0 ? 'text-blue-600' : 'text-green-600'}`}>{p.diff}</td>
                                                        <td className="p-1"><input type="text" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} className="w-24 p-1.5 border rounded-lg text-[10px] bg-emerald-50/30" placeholder="$" /></td>
                                                        <td className="p-1"><input type="text" value={item.justificacion} onChange={(e) => updateItem(idx, 'justificacion', e.target.value)} className="w-full border-b p-1.5 text-[10px] outline-none transparent-input" placeholder="Justificación..." /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[500px]">
                            <div className="flex justify-between items-center mb-10 border-b pb-4">
                                <h3 className="text-xl font-black uppercase text-[#183C30] flex items-center gap-3"><History className="h-6 w-6" /> {viewTab === 'drafts' ? 'Borradores en Curso' : 'Actas Cerradas'}</h3>
                                <button onClick={fetchActas} className="px-5 py-2.5 bg-[#183C30] text-white rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition-all shadow-lg">SINCRONIZAR</button>
                            </div>
                            {isLoadingHistory ? <div className="flex flex-col items-center justify-center py-24 gap-4"><div className="w-10 h-10 border-4 border-gray-100 border-t-[#183C30] rounded-full animate-spin"></div><p className="text-[10px] font-black uppercase text-gray-300">Consultando Base de Datos...</p></div> : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {(Array.isArray(savedActas) ? savedActas : []).filter(a => viewTab === 'drafts' ? a?.status === 'draft' : a?.status === 'final').slice().reverse().map(acta => (
                                        <div key={acta?.id} onClick={() => handleLoadActa(acta)} className={`p-6 bg-white rounded-2xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 ${acta?.status === 'draft' ? 'border-amber-50 hover:border-amber-200' : 'border-blue-50 hover:border-blue-200'}`}>
                                            <div className="flex justify-between mb-4">
                                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${acta?.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{acta?.status === 'draft' ? 'BORRADOR' : 'FINALIZADA'}</span>
                                                <span className="text-[9px] font-bold text-gray-300">ID: {acta?.id?.slice(-6).toUpperCase()}</span>
                                            </div>
                                            <h4 className="text-sm font-black text-gray-900 uppercase line-clamp-1">{acta?.data?.company || 'Sin Empresa'}</h4>
                                            <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">{acta?.data?.periodo}</p>
                                            <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-50">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-gray-300 uppercase">F. Registro</span>
                                                    <span className="text-[10px] font-black text-gray-400">{acta?.date ? new Date(acta.date).toLocaleDateString() : 'N/A'}</span>
                                                </div>
                                                <ArrowLeft className="h-4 w-4 rotate-180 text-[#183C30]" />
                                            </div>
                                        </div>
                                    ))}
                                    {(Array.isArray(savedActas) ? savedActas : []).filter(a => viewTab === 'drafts' ? a?.status === 'draft' : a?.status === 'final').length === 0 && (
                                        <div className="col-span-full py-24 border-4 border-dotted border-gray-50 rounded-[2rem] text-center flex flex-col items-center justify-center text-gray-300 opacity-50">
                                            <FileText className="h-12 w-12 mb-4" />
                                            <p className="font-black text-xs uppercase tracking-widest">No se detectaron registros en esta categoría</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="max-w-[850px] mx-auto pb-20 no-print">
                    <div className="flex justify-between items-center bg-white/90 backdrop-blur p-4 rounded-2xl shadow-2xl mb-10 sticky top-4 z-50 border border-white">
                        <button onClick={() => setViewMode("form")} className="flex items-center gap-2 text-xs font-black bg-gray-100 px-5 py-3 rounded-xl hover:bg-gray-200 transition-all"><ArrowLeft className="h-4 w-4" /> REGRESAR AL EDITOR</button>
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="bg-gray-800 text-white px-5 py-3 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg"><Printer className="h-4 w-4" /> IMPRIMIR</button>
                            <button onClick={handleDownloadPDF} className="bg-[#183C30] text-white px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"><Download className="h-4 w-4" /> EXPORTAR PDF</button>
                        </div>
                    </div>

                    <div ref={printRef} className="print-section bg-white shadow-2xl relative overflow-hidden p-16" style={{ minHeight: '1120px' }}>
                        {status === 'draft' && <div className="watermark">BORRADOR</div>}
                        <div className={`status-badge ${status === 'draft' ? 'status-draft' : 'status-final'}`}>{status === 'draft' ? 'Borrador No Oficial' : 'Documento Oficial de Cierre'}</div>

                        <div className="flex justify-between items-start mb-12 border-b-4 border-[#183C30] pb-8">
                            <div>
                                <div className="bg-[#183C30] text-white px-4 py-1.5 rounded-lg mb-4 inline-block font-black text-[10px] tracking-widest uppercase">Acta de Cierre de Inventario</div>
                                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none">{company}</h2>
                                <p className="text-[11px] font-bold text-gray-400 mt-2 uppercase tracking-wide">Registro de Diferencias de Bodega y Auditoría de Stock</p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                                <span className="text-[10px] font-black text-gray-300 uppercase">Documento No.</span>
                                <p className="text-sm font-black text-[#183C30] font-mono">{consecutivo}</p>
                                <p className="text-xs font-black text-gray-500 mt-2 uppercase">{fecha} · {periodo}</p>
                            </div>
                        </div>

                        <div className="bg-gray-50/50 border border-gray-100 p-8 rounded-3xl mb-12 space-y-4">
                            <h4 className="font-black text-[#183C30] text-[11px] uppercase tracking-widest flex items-center gap-2 border-b pb-2"><AlertTriangle className="h-4 w-4" /> Declaración Operativa</h4>
                            <p className="text-justify text-[13px] leading-relaxed text-gray-700 font-medium italic">
                                Por medio de la presente acta, se certifica el cierre del conteo físico correspondiente al período de <strong>{periodo}</strong> efectuado en las instalaciones de <strong>{company}</strong> operado por <strong>GRUPO HUMAN PROJECT / EMPAQUES Y SOLUCIONES</strong>. Los valores consignados a continuación representan la conciliación final entre lo registrado en el software contable (Siigo) y el conteo físico validado por auditoría. Se aclara que cualquier faltante no justificado será objeto de análisis administrativo y potencial cobro de acuerdo a las políticas de la empresa.
                            </p>
                        </div>

                        <div className="space-y-16">
                            <div>
                                <h3 className="font-black text-[11px] uppercase text-[#183C30] mb-6 border-b-2 border-gray-100 flex items-center gap-3 pb-2"><LayoutGrid className="h-4 w-4" /> 1. Resumen de Diferencias (Conteo Principal)</h3>
                                <table className="w-full text-center text-[10px] border-collapse">
                                    <thead className="bg-[#183C30] text-white">
                                        <tr>
                                            <th className="p-3 text-left rounded-tl-xl border-r border-[#ffffff33]">Referencia / SKU</th>
                                            <th className="p-3 border-r border-[#ffffff33]">Stock Teórico</th>
                                            <th className="p-3 border-r border-[#ffffff33]">Conteo Físico</th>
                                            <th className="p-3 rounded-tr-xl">Variación (Dif)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y border-x border-b border-gray-100">
                                        {processedItems.filter(i => i.s_total > 0 || i.p_total > 0).map(i => (
                                            <tr key={i.sku} className="hover:bg-gray-50/50">
                                                <td className="p-3 text-left font-bold text-gray-800 border-r border-gray-100 bg-gray-50/30">
                                                    <div className="flex flex-col"><span className="text-[11px]">{i.sku}</span><span className="text-[9px] text-gray-400 font-medium uppercase truncate w-[200px]">{i.name}</span></div>
                                                </td>
                                                <td className="p-3 border-r border-gray-100 text-gray-600 font-bold">{i.s_total}</td>
                                                <td className="p-3 border-r border-gray-100 font-black text-gray-800">{i.p_total}</td>
                                                <td className={`p-3 font-black ${i.diff < 0 ? 'text-red-700 bg-red-50/30' : i.diff > 0 ? 'text-blue-700 bg-blue-50/30' : 'text-emerald-700 bg-emerald-50/30'}`}>{i.diff}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-900 text-white font-black uppercase text-[10px]">
                                        <tr>
                                            <td className="p-3 text-right">Totales Globales:</td>
                                            <td className="p-3">{processedItems.reduce((s,i)=>s+i.s_total,0)}</td>
                                            <td className="p-3">{processedItems.reduce((s,i)=>s+i.p_total,0)}</td>
                                            <td className="p-3">{processedItems.reduce((s,i)=>s+i.diff,0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {processedItems.some(i => i.bTr > 0 || i.bPer > 0 || i.justificacion) && (
                                <div style={{ pageBreakInside: 'avoid' }}>
                                    <h3 className="font-black text-[11px] uppercase text-[#183C30] mb-6 border-b-2 border-gray-100 flex items-center gap-3 pb-2"><History className="h-4 w-4" /> 2. Desglose de Bodegas y Justificaciones Técnicas</h3>
                                    <table className="w-full text-center text-[9px] border-collapse border border-gray-100">
                                        <thead className="bg-gray-100 text-gray-700">
                                            <tr>
                                                <th className="p-3 text-left border-r w-[240px]">Referencia</th>
                                                <th className="p-3 border-r text-amber-700">Bodega Tránsito</th>
                                                <th className="p-3 border-r text-red-700">Bodega Pérdida</th>
                                                <th className="p-3 border-r text-gray-500">Custodia (@)</th>
                                                <th className="p-3 text-left">Observaciones de Auditoría</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {processedItems.filter(i => i.bTr > 0 || i.bPer > 0 || i.justificacion).map(i => (
                                                <tr key={i.sku} className="bg-gray-50/10">
                                                    <td className="p-3 text-left font-black text-gray-800 border-r">{i.sku} <span className="text-[7px] text-gray-400 opacity-50 block">{i.name}</span></td>
                                                    <td className="p-3 border-r font-bold">{i.bTr || '-'}</td>
                                                    <td className="p-3 border-r font-bold">{i.bPer || '-'}</td>
                                                    <td className="p-3 border-r font-medium text-gray-400">{i.bCus || '-'}</td>
                                                    <td className="p-3 text-left italic text-gray-500 font-medium px-4">{i.justificacion || 'Sin observaciones registradas.'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {observaciones && (
                                <div style={{ pageBreakInside: 'avoid' }} className="p-8 bg-[#183C30]/5 rounded-[2rem] border-2 border-dashed border-[#183C30]/10 text-[12px] italic leading-relaxed shadow-inner">
                                    <strong className="text-[#183C30] uppercase not-italic mb-3 block tracking-tighter font-black border-b border-[#183C30]/10 pb-1">Dictamen General del Auditor:</strong>
                                    "{observaciones}"
                                </div>
                            )}

                            <div className="mt-40 space-y-16" style={{ pageBreakInside: 'avoid' }}>
                                <div className="p-6 bg-gray-50 rounded-2xl border mb-16">
                                    <p className="text-[10px] text-gray-500 text-center uppercase font-black tracking-widest">Compromiso Legal y Firmas</p>
                                    <p className="text-[9px] text-gray-400 text-center mt-2 px-10">Al firmar este documento, todas las partes aceptan la veracidad de los datos aquí consignados y se comprometen a realizar los ajustes contables y administrativos pertinentes en un plazo no mayor a 5 días hábiles.</p>
                                </div>
                                <div className="grid grid-cols-3 gap-16">
                                    <div className="text-center">
                                        <div className="border-b-2 border-gray-900 mb-2 w-48 mx-auto h-[40px]"></div>
                                        <p className="font-black uppercase text-[9px] text-gray-800">Responsable Inventario</p>
                                        <p className="text-[8px] text-gray-400 uppercase tracking-tighter">Firma y Cédula</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="border-b-2 border-gray-900 mb-2 w-48 mx-auto h-[40px]"></div>
                                        <p className="font-black uppercase text-[9px] text-gray-800">Auditor de Calidad</p>
                                        <p className="text-[8px] text-gray-400 uppercase tracking-tighter">Validación de Stock</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="border-b-2 border-gray-900 mb-2 w-48 mx-auto h-[40px]"></div>
                                        <p className="font-black uppercase text-[9px] text-gray-800">Gerencia / Rep. Legal</p>
                                        <p className="text-[8px] text-gray-400 uppercase tracking-tighter">Aprobación Final</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-20 border-t pt-6 text-center text-gray-300 text-[8px] font-black uppercase tracking-[0.3em]">
                            Generado Digitalmente por GCO PLATFORM v2.0 · {new Date().toLocaleString()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
