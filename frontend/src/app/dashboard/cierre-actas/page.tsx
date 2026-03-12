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
    justificacion_bodegas_externas?: string; // New: Specific justification for Transit/Loss/Custody
    physicalFree: number | '';
    systemFree: number | '';
    system: number | '';
    unitPrice: number | '';
    physicalFree_just?: string; // New: Justification for free physical stock
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
            physical: '', bPrincipal: '', bAverias: '', bComercExt: '', bLibre: '', bTransito: '', bPerdida: '', bDos: '', bCustodia: '', justificacion: '', justificacion_bodegas_externas: '', system: '', unitPrice: '', physicalFree: '', systemFree: ''
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
            // Handle both direct array and wrapped response for maximum compatibility
            const data = response.data;
            const actualList = Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []);
            setSavedActas(actualList);
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
        // AUDITED WAREHOUSES (Compare vs Physical)
        const s_base = (Number(i.bPrincipal) || 0) + (Number(i.bAverias) || 0) + (Number(i.bComercExt) || 0) + (Number(i.bLibre) || 0);
        const s_free = Number(i.systemFree) || 0;
        const p_base = Number(i.physical) || 0;
        const p_free = Number(i.physicalFree) || 0;
        
        // NON-AUDITED WAREHOUSES (Informative)
        const bTr = Number(i.bTransito) || 0;
        const bPer = Number(i.bPerdida) || 0;
        const bD = Number(i.bDos) || 0;
        const bCus = Number(i.bCustodia) || 0;

        return {
            ...i,
            s: s_base,
            s_free,
            s_total: s_base + s_free,
            p: p_base,
            p_free,
            p_total: p_base + p_free,
            diff: (p_base + p_free) - (s_base + s_free),
            bTr,
            bPer,
            bD,
            bCus,
            bComExt: Number(i.bComercExt) || 0,
            hasExternalUnits: bTr > 0 || bPer > 0 || bD > 0 || bCus > 0
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
            // Important: refresh actas list immediately
            setTimeout(fetchActas, 500); 
        } catch (error) { toast.error("Error al guardar"); } finally { setIsSaving(false); }
    };

    const printRef = useRef<HTMLDivElement>(null);
    const handleDownloadPDF = async () => {
        if (!printRef.current) return;
        const toastId = toast.loading("Preparando exportación de alta calidad...");
        
        try {
            const element = printRef.current;
            const filename = `Acta_Cierre_${company.replace(/ /g, '_')}_${periodo.replace(/ /g, '_')}.pdf`;

            // Wait for animations and fonts to stabilize
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Use scale 1.4: Higher than 1.0 for quality, but lower than 2.0 to avoid memory crashes
            let canvas: HTMLCanvasElement;
            try {
                canvas = await html2canvas(element, {
                    scale: 1.4,
                    useCORS: true,
                    backgroundColor: "#ffffff",
                    logging: false,
                    windowWidth: 1000,
                    imageTimeout: 0, // No limit for image loading
                    onclone: (doc) => {
                        // Ensure everything is visible in the clone
                        const el = doc.querySelector('.print-section') as HTMLElement;
                        if (el) el.style.boxShadow = 'none';
                    }
                });
            } catch (innerErr) {
                console.warn("Retrying with Safe Mode (Scale 1.0)");
                canvas = await html2canvas(element, {
                    scale: 1.0,
                    useCORS: true,
                    backgroundColor: "#ffffff",
                    windowWidth: 1000
                });
            }

            const pdf = new jsPDF("p", "mm", "a4");
            const imgWidth = 210; 
            const pageHeight = 297; 
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            // Use JPEG 0.9 for balance between quality and file size
            const imgData = canvas.toDataURL("image/jpeg", 0.9);
            
            pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, 'FAST');
                heightLeft -= pageHeight;
            }

            pdf.save(filename);
            toast.success("PDF generado correctamente ✓", { id: toastId });
        } catch (e: any) {
            console.error("PDF Export Error:", e);
            toast.error("El documento es muy grande. Intenta usar la opción 'IMPRIMIR' y 'Guardar como PDF'.", { id: toastId });
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20 pt-10">
            <style jsx global>{`
                @media print { 
                    /* ROOT FIX: Hide everything except the target section */
                    body > * { display: none !important; }
                    body > .print-container, .print-container { display: block !important; }
                    
                    /* If using a layout with main/sidebar, ensure they are hidden */
                    nav, aside, header, footer, .no-print { display: none !important; }
                    main { margin: 0 !important; padding: 0 !important; width: 100% !important; display: block !important; }
                    
                    .print-section { 
                        display: block !important;
                        position: relative !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                }
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
                                                <th className="p-2">Justificación Conciliación / Notas Bodegas Externas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {items.map((item, idx) => {
                                                const p = processedItems[idx];
                                                const isEssential = SALES_CODES.includes(item.sku);
                                                const hasData = p.s_total > 0 || p.p_total > 0 || item.physical !== '' || p.bTr > 0 || p.bPer > 0 || p.bCus > 0;
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
                                                        <td className="p-1 bg-red-50/30"><input type="text" value={item.bPerdida} onChange={(e) => updateItem(idx, 'bPerdida', e.target.value)} className="w-14 text-center p-1.5 border rounded-lg text-[10px] text-red-700 font-bold" placeholder="P" /></td>
                                                        <td className="p-1"><input type="text" value={item.systemFree} onChange={(e) => updateItem(idx, 'systemFree', e.target.value)} className="w-10 text-center p-1.5 border rounded-lg text-[10px]" /></td>
                                                        <td className="p-2 text-center font-bold text-[11px] text-gray-400">{p.s_total}</td>
                                                        <td className={`p-2 text-center font-black text-[11px] ${p.diff < 0 ? 'text-red-600' : p.diff > 0 ? 'text-blue-600' : 'text-green-600'}`}>{p.diff}</td>
                                                        <td className="p-1"><input type="text" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} className="w-24 p-1.5 border rounded-lg text-[10px] bg-emerald-50/30" placeholder="$" /></td>
                                                        <td className="p-1 space-y-2">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase">Gral / Conciliación:</span>
                                                                <input type="text" value={item.justificacion} onChange={(e) => updateItem(idx, 'justificacion', e.target.value)} className="w-full border-b p-1 text-[9px] outline-none transparent-input" placeholder="Justificación principal..." />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[8px] font-bold text-amber-600 uppercase">Bodegas Transito/Perdida/Cus:</span>
                                                                <input type="text" value={item.justificacion_bodegas_externas || ''} onChange={(e) => updateItem(idx, 'justificacion_bodegas_externas', e.target.value)} className="w-full border-b p-1 text-[9px] outline-none border-amber-100 bg-amber-50/5" placeholder="¿Por qué están allí? (Ej: Traslado pendiente)..." />
                                                            </div>
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
                <div className="max-w-[1000px] mx-auto pb-20 no-print">
                    <div className="flex justify-between items-center bg-white/90 backdrop-blur p-4 rounded-2xl shadow-2xl mb-10 sticky top-4 z-50 border border-white">
                        <button onClick={() => setViewMode("form")} className="flex items-center gap-2 text-xs font-black bg-gray-100 px-5 py-3 rounded-xl hover:bg-gray-200 transition-all"><ArrowLeft className="h-4 w-4" /> REGRESAR AL EDITOR</button>
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="bg-gray-800 text-white px-5 py-3 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg"><Printer className="h-4 w-4" /> IMPRIMIR</button>
                            <button onClick={handleDownloadPDF} className="bg-[#183C30] text-white px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"><Download className="h-4 w-4" /> EXPORTAR PDF</button>
                        </div>
                    </div>

                    <div ref={printRef} className="print-section print-container bg-white shadow-2xl relative overflow-hidden p-12 text-[#1f2937]" style={{ minHeight: '1120px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {status === 'draft' && <div className="watermark">BORRADOR</div>}
                        
                        {/* Header Official */}
                        <div className="flex justify-between items-stretch border-2 border-black mb-8">
                            <div className="w-1/4 p-4 border-r-2 border-black flex items-center justify-center">
                                <div className="text-center">
                                    <p className="font-black text-xs leading-none">ORIGEN</p>
                                    <p className="font-light text-[10px] tracking-[0.2em]">BOTÁNICO</p>
                                </div>
                            </div>
                            <div className="w-2/4 p-4 border-r-2 border-black flex flex-col items-center justify-center text-center">
                                <h1 className="font-black text-sm uppercase">Acta de Inventario de Producto Terminado</h1>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Control de Existencias y Auditoría de Stock</p>
                            </div>
                            <div className="w-1/4 text-[9px] font-bold">
                                <div className="p-2 border-b-2 border-black">CÓDIGO: FI-004 V2</div>
                                <div className="p-2 border-b-2 border-black">FECHA: 07/2024</div>
                                <div className="p-2">PÁGINA: 1 de 2</div>
                            </div>
                        </div>

                        {/* General Info */}
                        <div className="grid grid-cols-3 gap-0 border-2 border-black mb-8 text-[10px]">
                            <div className="p-3 border-r-2 border-b-2 border-black bg-gray-50">
                                <span className="block font-black uppercase text-gray-400 text-[8px]">Empresa Auditada</span>
                                <span className="font-bold">{company}</span>
                            </div>
                            <div className="p-3 border-r-2 border-b-2 border-black bg-gray-50">
                                <span className="block font-black uppercase text-gray-400 text-[8px]">Consecutivo de Acta</span>
                                <span className="font-bold">{consecutivo}</span>
                            </div>
                            <div className="p-3 border-b-2 border-black bg-gray-50">
                                <span className="block font-black uppercase text-gray-400 text-[8px]">Fecha de Elaboración</span>
                                <span className="font-bold">{fecha}</span>
                            </div>
                            <div className="p-3 border-r-2 border-black">
                                <span className="block font-black uppercase text-gray-400 text-[8px]">Período de Cierre</span>
                                <span className="font-bold uppercase">{periodo}</span>
                            </div>
                            <div className="p-3 border-r-2 border-black">
                                <span className="block font-black uppercase text-gray-400 text-[8px]">Responsable Logística</span>
                                <span className="font-bold">EMPAQUES Y SOLUCIONES</span>
                            </div>
                            <div className="p-3">
                                <span className="block font-black uppercase text-gray-400 text-[8px]">Metodología de Control</span>
                                <span className="font-bold">Doble Ciego / Auditoría Selectiva</span>
                            </div>
                        </div>

                        {/* 1. Desarrollo */}
                        <div className="mb-8">
                            <h3 className="bg-gray-100 p-2 font-black text-xs uppercase border-l-4 border-[#183C30] mb-4">1. Desarrollo del Conteo Físico</h3>
                            <div className="text-[11px] leading-relaxed space-y-3 px-2">
                                <p>
                                    Se realizó el levantamiento físico de inventario aplicando el <strong>Principio de Verificación Dual</strong>. El equipo de auditoría validó el 100% de las unidades en estantería y zona de packing.
                                </p>
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div className="space-y-1">
                                        <p className="font-bold flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded-full"></span> Grupo 1: Identificación con sticker verde</p>
                                        <p className="font-bold flex items-center gap-2"><span className="w-3 h-3 bg-blue-500 rounded-full"></span> Grupo 2: Identificación con sticker azul</p>
                                        <p className="font-bold flex items-center gap-2"><span className="w-3 h-3 bg-orange-500 rounded-full"></span> Reconteo: Identificación con sticker naranja</p>
                                    </div>
                                    <div>
                                        <p className="font-black text-[9px] uppercase text-gray-400 mb-1">Metodología de Auditoría</p>
                                        <p className="italic text-gray-600">
                                            Se verificó cada estiba por posición. Dentro de cada unidad de carga, se auditaron cajas al azar. Una vez validado, se procedió al sellado de seguridad con el rotulado correspondiente.
                                        </p>
                                    </div>
                                </div>
                                <p className="bg-amber-50 p-3 rounded-lg border border-amber-100 font-medium italic">
                                    <strong>Nota Aclaratoria:</strong> Todos los ajustes derivados del presente cierre de inventario serán realizados en la empresa <strong>{company}</strong>, garantizando la trazabilidad documental ante entes reguladores.
                                </p>
                            </div>
                        </div>

                        {/* 2. Hallazgos */}
                        <div className="mb-8" style={{ pageBreakInside: 'avoid' }}>
                            <h3 className="bg-gray-100 p-2 font-black text-xs uppercase border-l-4 border-[#183C30] mb-4">2. Hallazgos del Inventario (Matriz de Variaciones)</h3>
                            <table className="w-full text-center text-[10px] border-collapse">
                                <thead className="bg-[#183C30] text-white">
                                    <tr>
                                        <th className="p-3 text-left">Referencia / SKU</th>
                                        <th className="p-3">
                                            <div className="flex flex-col">
                                                <span>Sistema (Und)</span>
                                                <span className="text-[7px] font-normal opacity-60 uppercase tracking-tighter">Principal + Avería + Com. Ext + Libre + Sist. Libre</span>
                                            </div>
                                        </th>
                                        <th className="p-3">
                                            <div className="flex flex-col">
                                                <span>Físico (Und)</span>
                                                <span className="text-[7px] font-normal opacity-60 uppercase tracking-tighter">Conteo Bodegas + Físico Libre</span>
                                            </div>
                                        </th>
                                        <th className="p-3">Diferencia</th>
                                        <th className="p-3">Estado Operativo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y border-x border-b border-gray-100">
                                    {processedItems.filter(i => i.s_total > 0 || i.p_total > 0).map(i => (
                                        <tr key={i.sku} className="hover:bg-gray-50/10">
                                            <td className="p-3 text-left border-r bg-gray-50/20">
                                                <div className="flex flex-col"><span className="font-black text-[11px]">{i.sku}</span><span className="text-[9px] text-gray-400 font-bold uppercase truncate w-[250px]">{i.name}</span></div>
                                            </td>
                                            <td className="p-3 border-r font-bold text-gray-500">{i.s_total}</td>
                                            <td className="p-3 border-r font-black text-gray-800">{i.p_total}</td>
                                            <td className={`p-3 border-r font-black ${i.diff < 0 ? 'text-red-700' : i.diff > 0 ? 'text-blue-700' : 'text-emerald-700'}`}>
                                                {i.diff > 0 ? `+${i.diff}` : i.diff}
                                            </td>
                                            <td className="p-3 font-bold uppercase">
                                                {i.diff < 0 ? <span className="text-red-600 bg-red-50 px-2 py-1 rounded">Faltante</span> : i.diff > 0 ? <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">Sobrante</span> : <span className="text-green-600">Exacto</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 3. Novedades y Cobros */}
                        <div className="mb-8" style={{ pageBreakInside: 'avoid' }}>
                            <h3 className="bg-gray-100 p-2 font-black text-xs uppercase border-l-4 border-[#183C30] mb-4">3. Novedades Pendientes y Gestión de Cobros</h3>
                            <div className="grid grid-cols-1 gap-6">
                                <div className="border border-red-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="bg-red-600 text-white p-3 font-black text-[10px] uppercase tracking-widest flex justify-between items-center">
                                        <span>Cobro a Operador Logístico (Empaques y Soluciones)</span>
                                        <span className="bg-white text-red-600 px-3 py-1 rounded-full text-xs">FALTANTES</span>
                                    </div>
                                    <table className="w-full text-[10px]">
                                        <thead className="bg-red-50 text-red-700">
                                            <tr>
                                                <th className="p-2 text-left">SKU - Producto</th>
                                                <th className="p-2 text-center">Unidades</th>
                                                <th className="p-2 text-right">Valor Unit.</th>
                                                <th className="p-2 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {processedItems.filter(i => i.diff < 0).map(i => (
                                                <tr key={i.sku}>
                                                    <td className="p-2 font-bold">{i.sku} - <span className="font-normal text-gray-500 italic">{i.name}</span></td>
                                                    <td className="p-2 text-center font-black">{Math.abs(i.diff)}</td>
                                                    <td className="p-2 text-right font-mono text-gray-500">${(Number(i.unitPrice) || 0).toLocaleString()}</td>
                                                    <td className="p-2 text-right font-black text-red-800">${(Math.abs(i.diff) * (Number(i.unitPrice) || 0)).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {processedItems.filter(i => i.diff < 0).length === 0 && (
                                                <tr><td colSpan={4} className="p-6 text-center text-gray-400 italic">No se registran faltantes para cobro en este acta.</td></tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-red-600 text-white font-black uppercase">
                                            <tr>
                                                <td colSpan={3} className="p-3 text-right">Total a Cobrar:</td>
                                                <td className="p-3 text-right text-sm">${totalDeudaEmpaques.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="bg-blue-600 text-white p-3 font-black text-[10px] uppercase tracking-widest flex justify-between items-center">
                                        <span>Relocalización de Inventario Excedente</span>
                                        <span className="bg-white text-blue-600 px-3 py-1 rounded-full text-xs">BODEGA CUSTODIA</span>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 gap-4 text-[11px]">
                                        {processedItems.filter(i => i.diff > 0).map(i => (
                                            <div key={i.sku} className="flex justify-between items-center border-b border-gray-100 pb-2">
                                                <span className="font-bold flex-1 truncate pr-2 tracking-tighter uppercase">{i.name}</span>
                                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md font-black">{i.diff} UND</span>
                                            </div>
                                        ))}
                                        {processedItems.filter(i => i.diff > 0).length === 0 && (
                                            <p className="col-span-2 text-center text-gray-400 italic py-4">No se registran excedentes para custodia.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Acciones */}
                        <div className="mb-8" style={{ pageBreakInside: 'avoid' }}>
                            <h3 className="bg-gray-100 p-2 font-black text-xs uppercase border-l-4 border-[#183C30] mb-4">4. Plan de Acción y Mejora Continua</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[10px] bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                                <div className="space-y-3">
                                    <p className="font-black text-[#183C30] uppercase border-b border-[#183C30]/10 pb-1">Gestión Logística</p>
                                    <p className="flex gap-2"><span>●</span> <span className="font-medium text-gray-600 italic">Obligatoriedad de soporte físico (Remisión) para traslados interestatales.</span></p>
                                    <p className="flex gap-2"><span>●</span> <span className="font-medium text-gray-600 italic">Conciliación documental previa al inventario para mitigar errores de digitación.</span></p>
                                    <p className="flex gap-2"><span>●</span> <span className="font-medium text-gray-600 italic">Formación de kits (Dúos/Combos) al menos 48 horas antes del conteo oficial.</span></p>
                                </div>
                                <div className="space-y-3">
                                    <p className="font-black text-[#183C30] uppercase border-b border-[#183C30]/10 pb-1">Control de Calidad</p>
                                    <p className="flex gap-2"><span>●</span> <span className="font-medium text-gray-600 italic">Ingreso total a SIIGO el último día hábil del mes. Corte de facturación estricto.</span></p>
                                    <p className="flex gap-2"><span>●</span> <span className="font-medium text-gray-600 italic">Veda de recepción de vehículos de carga el último día del período fiscal.</span></p>
                                    <p className="flex gap-2"><span>●</span> <span className="font-medium text-gray-600 italic">Auditoría selectiva de pesos en productos de alta rotación (Shampoos).</span></p>
                                </div>
                            </div>
                        </div>

                        {/* 5. Saldos Finales Grid */}
                        <div className="mb-12" style={{ pageBreakInside: 'avoid' }}>
                            <h3 className="bg-gray-100 p-2 font-black text-xs uppercase border-l-4 border-[#183C30] mb-4">5. Saldos de Certificación Post-Ajuste (Auditados)</h3>
                            <p className="text-[10px] text-gray-400 italic mb-4">*Cantidades que deben reflejarse en las bodegas auditadas (Principal, Avería, etc.) tras el cierre.</p>
                            <div className="grid grid-cols-4 gap-4">
                                {processedItems.filter(i => i.p_total > 0).map(i => (
                                    <div key={i.sku} className="bg-white border-2 border-dashed border-gray-200 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] font-black text-gray-400 uppercase leading-tight mb-1">{i.name.split(' ').slice(0,3).join(' ')}...</span>
                                        <span className="text-sm font-black text-[#183C30]">{i.p_total} UND</span>
                                        <span className="text-[8px] font-bold text-gray-300 mt-1 uppercase">{i.sku}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 6. Bodegas No Auditadas (New Section) */}
                        <div className="mb-12" style={{ pageBreakInside: 'avoid' }}>
                            <h3 className="bg-gray-100 p-2 font-black text-xs uppercase border-l-4 border-amber-500 mb-4">6. Conciliación de Bodegas Externas e Informativas (No Auditadas)</h3>
                            <p className="text-[10px] text-gray-400 italic mb-4">Unidades que no forman parte del conteo físico directo pero se encuentran bajo control administrativo (Tránsito, Pérdida y Custodia).</p>
                            <table className="w-full text-center text-[9px] border-collapse border border-gray-100">
                                <thead className="bg-gray-900 text-white">
                                    <tr>
                                        <th className="p-3 text-left w-[200px]">Referencia</th>
                                        <th className="p-3 bg-amber-800">Tránsito</th>
                                        <th className="p-3 bg-red-800">Pérdida</th>
                                        <th className="p-3 bg-gray-700">Custodia</th>
                                        <th className="p-3 text-left">Motivo / Justificación de la Existencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y relative">
                                    {processedItems.filter(i => i.hasExternalUnits || i.justificacion_bodegas_externas).map(i => (
                                        <tr key={i.sku} className="bg-amber-50/10">
                                            <td className="p-3 text-left font-black text-gray-800 border-r">{i.sku} <span className="text-[7px] text-gray-400 opacity-50 block uppercase">{i.name}</span></td>
                                            <td className="p-3 border-r font-bold text-amber-700">{i.bTr || '0'}</td>
                                            <td className="p-3 border-r font-bold text-red-700">{i.bPer || '0'}</td>
                                            <td className="p-3 border-r font-black text-gray-600">{i.bCus || '0'}</td>
                                            <td className="p-3 text-left italic text-gray-500 font-medium px-4">
                                                {i.justificacion_bodegas_externas || <span className="text-gray-300">Sin justificación técnica registrada.</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {processedItems.filter(i => i.hasExternalUnits || i.justificacion_bodegas_externas).length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">No se detectaron saldos en bodegas externas para el presente período.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* 7 y 8. Indicadores (Re-numbered) */}
                        <div className="grid grid-cols-2 gap-8 mb-12" style={{ pageBreakInside: 'avoid' }}>
                            <div>
                                <h3 className="bg-gray-100 p-2 font-black text-xs uppercase border-l-4 border-[#183C30] mb-4">7. Dictamen de Auditoría</h3>
                                <div className="p-6 bg-[#183C30]/5 rounded-[2rem] border-2 border-dashed border-[#183C30]/10 text-[11px] italic leading-relaxed text-gray-600">
                                    <strong className="text-[#183C30] uppercase not-italic mb-2 block tracking-tighter font-black">Conclusiones del Auditor:</strong>
                                    {observaciones || "Se certifica que el proceso de conteo cumplió con los estándares de control interno de la organización. No se detectaron anomalías estructurales en el almacenamiento, delegando la responsabilidad de los ajustes operativos al área contable según los hallazgos del punto 2."}
                                </div>
                            </div>
                            <div>
                                <h3 className="bg-gray-100 p-2 font-black text-xs uppercase border-l-4 border-emerald-500 mb-4">8. Indicadores de Confiabilidad (KPIs)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center">
                                        <span className="text-[9px] font-black text-emerald-600 uppercase">Exactitud Stock</span>
                                        <span className="text-2xl font-black text-emerald-700">{exactitudUnidades.toFixed(2)}%</span>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center">
                                        <span className="text-[9px] font-black text-blue-600 uppercase">Referencias</span>
                                        <span className="text-2xl font-black text-blue-700">{processedItems.filter(i => i.s_total > 0 || i.p_total > 0).length}</span>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex flex-col items-center col-span-2">
                                        <span className="text-[9px] font-black text-red-600 uppercase">Efectividad de Registro</span>
                                        <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden flex">
                                            <div className="bg-emerald-500 h-full" style={{ width: `${exactitudUnidades}%` }}></div>
                                            <div className="bg-red-500 h-full" style={{ width: `${100-exactitudUnidades}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="mt-40 space-y-16" style={{ pageBreakInside: 'avoid' }}>
                            <div className="p-6 bg-gray-50 rounded-2xl border mb-16">
                                <p className="text-[10px] text-gray-500 text-center uppercase font-black tracking-widest">Compromiso Legal y Firmas</p>
                                <p className="text-[9px] text-gray-400 text-center mt-2 px-10 italic">
                                    Al firmar este documento, las partes aceptan que el conteo físico es la verdad absoluta para fines contables y fiscales del período {periodo}. El operador logístico reconoce los faltantes y autoriza el trámite de cobro o reposición según contrato vigente.
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-16">
                                <div className="text-center">
                                    <div className="border-b-2 border-black mb-2 w-48 mx-auto h-[40px]"></div>
                                    <p className="font-black uppercase text-[9px] text-gray-800">Responsable Inventario</p>
                                    <p className="text-[8px] text-gray-400 uppercase tracking-tighter">EMPAQUES Y SOLUCIONES</p>
                                </div>
                                <div className="text-center">
                                    <div className="border-b-2 border-black mb-2 w-48 mx-auto h-[40px]"></div>
                                    <p className="font-black uppercase text-[9px] text-gray-800">Auditor de Calidad</p>
                                    <p className="text-[8px] text-gray-400 uppercase tracking-tighter">VALIDADOR GCO</p>
                                </div>
                                <div className="text-center">
                                    <div className="border-b-2 border-black mb-2 w-48 mx-auto h-[40px]"></div>
                                    <p className="font-black uppercase text-[9px] text-gray-800">Gerencia / Rep. Legal</p>
                                    <p className="text-[8px] text-gray-400 uppercase tracking-tighter">APROBACIÓN FINAL</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 text-center text-gray-200 text-[8px] font-black uppercase tracking-[0.3em] py-10">
                            GCO PLATFORM v2.0.5 · SISTEMA DE AUDITORÍA AVANZADA · {new Date().toLocaleString()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
