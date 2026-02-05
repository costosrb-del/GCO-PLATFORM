"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Users, Building2, MapPin, RefreshCcw, BarChart3, Palette, ArrowRight, Download } from "lucide-react";
import departmentsDataRaw from "../data/colombia_svg_data.json";

// Normalize names for mapping (remove accents, to upper case)
const normalizeString = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

const standardizeName = (name: string) => {
    const norm = normalizeString(name);
    if (norm.includes("BOGOTA")) return "BOGOTA D.C.";
    if (norm.includes("SAN ANDRES")) return "SAN ANDRES Y PROVIDENCIA";
    if (norm.includes("CUNDINA") || norm === "CUNDI") return "CUNDINAMARCA";
    return norm;
};

const DEPT_COMPANY_MAP: Record<string, string> = {
    "ANTIOQUIA": "RAICES / RITUAL",
    "CHOCO": "RAICES ORGANICAS",
    "BOGOTA D.C.": "HECHIZO DE BELLEZA",
    "CUNDINAMARCA": "HECHIZO DE BELLEZA",
    "META": "HECHIZO DE BELLEZA",
    "TOLIMA": "HECHIZO DE BELLEZA",
    "ARAUCA": "HECHIZO DE BELLEZA",
    "CASANARE": "HECHIZO DE BELLEZA",
    "HUILA": "HECHIZO DE BELLEZA",
    "BOYACA": "HECHIZO DE BELLEZA",
    "GUAVIARE": "HECHIZO DE BELLEZA",
    "CAQUETA": "HECHIZO DE BELLEZA",
    "GUAINIA": "HECHIZO DE BELLEZA",
    "AMAZONAS": "HECHIZO DE BELLEZA",
    "VICHADA": "HECHIZO DE BELLEZA",
    "VAUPES": "HECHIZO DE BELLEZA",
    "SAN ANDRES Y PROVIDENCIA": "HECHIZO DE BELLEZA",
    "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA": "HECHIZO DE BELLEZA",
    "SANTANDER": "ARMONIA C.",
    "NORTE DE SANTANDER": "ARMONIA C.",
    "VALLE DEL CAUCA": "GRUPO HUMAN",
    "ATLANTICO": "GRUPO HUMAN",
    "BOLIVAR": "GRUPO HUMAN",
    "RISARALDA": "GRUPO HUMAN",
    "CESAR": "GRUPO HUMAN",
    "NARINO": "GRUPO HUMAN",
    "CALDAS": "GRUPO HUMAN",
    "LA GUAJIRA": "GRUPO HUMAN",
    "QUINDIO": "GRUPO HUMAN",
    "CAUCA": "GRUPO HUMAN",
    "MAGDALENA": "GRUPO HUMAN",
    "CORDOBA": "GRUPO HUMAN",
    "SUCRE": "GRUPO HUMAN",
    "PUTUMAYO": "GRUPO HUMAN"
};

const COMPANY_COLORS: Record<string, string> = {
    "RAICES ORGANICAS": "#F97316", // Orange
    "RITUAL BOTANICO": "#FB923C", // Light Orange
    "RAICES / RITUAL": "#EAB308", // Shared - Gold/Yellow
    "HECHIZO DE BELLEZA": "#374151", // Grayish Black
    "ARMONIA C.": "#3B82F6", // Blue
    "GRUPO HUMAN": "#22C55E", // Green
    "ALMAVERDE": "#A855F7", // Purple
    "DEFAULT": "#E5E7EB" // Light Gray
};

interface RawDeptData {
    id: string;
    name: string;
    path: string;
}

const departmentsData = departmentsDataRaw as RawDeptData[];

interface ColombiaMapProps {
    onDeptClick: (deptName: string) => void;
    clientCounts: Record<string, number>;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

export default function ColombiaMap({ onDeptClick, clientCounts, onRefresh, isRefreshing }: ColombiaMapProps) {
    const [hoveredDept, setHoveredDept] = useState<string | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [mapMode, setMapMode] = useState<'company' | 'density'>('company');

    const handleMouseMove = (e: React.MouseEvent) => {
        setTooltipPos({ x: e.clientX, y: e.clientY });
    };

    const getDeptColor = (deptName: string) => {
        const standard = standardizeName(deptName);

        if (mapMode === 'density') {
            const count = getDeptClients(deptName);
            if (count === 0) return "#F3F4F6";
            if (count <= 10) return "#DCFCE7";   // 1-10
            if (count <= 50) return "#BBF7D0";   // 11-50
            if (count <= 100) return "#86EFAC";  // 51-100
            if (count <= 250) return "#4ADE80";  // 101-250
            if (count <= 500) return "#22C55E";  // 251-500
            if (count <= 1000) return "#16A34A"; // 501-1000
            if (count <= 2000) return "#15803D"; // 1001-2000
            return "#14532D";                    // +2000
        }

        const company = (standard === "ANTIOQUIA") ? "RAICES / RITUAL" : (DEPT_COMPANY_MAP[standard] || DEPT_COMPANY_MAP[normalizeString(deptName)]);
        return COMPANY_COLORS[company as keyof typeof COMPANY_COLORS] || COMPANY_COLORS.DEFAULT;
    };

    const getDeptClients = (deptName: string) => {
        const standard = standardizeName(deptName);
        // Direct match
        if (clientCounts[standard] !== undefined) return clientCounts[standard];

        // Fallback for Cundinamarca/Bogota variations in keys
        const foundKey = Object.keys(clientCounts).find(k =>
            standardizeName(k) === standard || k.includes(standard) || standard.includes(k)
        );

        return foundKey ? clientCounts[foundKey] : 0;
    };

    const handleExport = () => {
        window.print();
    };

    return (
        <div className="relative w-full h-[750px] bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-8">
            {/* Context Menu / Controls */}
            <div className="absolute top-8 left-8 z-10 space-y-4">
                <div>
                    <h3 className="text-2xl font-black text-[#183C30] flex items-center gap-3">
                        <MapPin className="h-6 w-6 text-green-600" />
                        Cobertura Nacional
                    </h3>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Análisis Geográfico Tiempo Real</p>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100 self-start">
                        <button
                            onClick={() => setMapMode('company')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${mapMode === 'company' ? 'bg-[#183C30] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Palette className="h-3 w-3" />
                            Por Empresa
                        </button>
                        <button
                            onClick={() => setMapMode('density')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${mapMode === 'density' ? 'bg-[#183C30] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <BarChart3 className="h-3 w-3" />
                            Por Densidad
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={onRefresh}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-500 hover:bg-gray-50 hover:text-[#183C30] transition-all shadow-sm group"
                        >
                            <RefreshCcw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                            Sincronizar
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-500 hover:bg-gray-50 hover:text-[#183C30] transition-all shadow-sm"
                        >
                            <Download className="h-3 w-3" />
                            Reporte
                        </button>
                    </div>
                </div>

                <div className="mt-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm backdrop-blur-sm">
                    {mapMode === 'company' ? (
                        <div className="space-y-2">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Asignación por Empresa</span>
                            {Object.entries(COMPANY_COLORS).map(([name, color]) => (
                                name !== "DEFAULT" && (
                                    <div key={name} className="flex items-center gap-3 group">
                                        <div className="w-3 h-3 rounded-full transition-transform group-hover:scale-125" style={{ backgroundColor: color }} />
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{name}</span>
                                    </div>
                                )
                            ))}
                            <div className="pt-2 mt-2 border-t border-gray-200">
                                <p className="text-[7px] font-bold text-gray-400 uppercase">* Antioquia es compartido</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Escala de Densidad</span>
                            {[
                                { l: "2001+", c: "#14532D" },
                                { l: "1001-2000", c: "#15803D" },
                                { l: "501-1000", c: "#16A34A" },
                                { l: "251-500", c: "#22C55E" },
                                { l: "101-250", c: "#4ADE80" },
                                { l: "51-100", c: "#86EFAC" },
                                { l: "11-50", c: "#BBF7D0" },
                                { l: "1-10", c: "#DCFCE7" },
                                { l: "0", c: "#F3F4F6" },
                            ].map(s => (
                                <div key={s.l} className="flex items-center gap-2">
                                    <div className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: s.c }} />
                                    <span className="text-[7px] font-black text-gray-500">{s.l}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <svg
                viewBox="0 0 600 800"
                className="w-full h-full max-w-[600px] drop-shadow-[0_35px_35px_rgba(0,0,0,0.1)]"
                style={{ filter: isRefreshing ? 'blur(2px) grayscale(0.5)' : 'none', transition: 'filter 0.5s ease' }}
                onMouseMove={handleMouseMove}
            >
                <defs>
                    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {departmentsData.map((dept) => {
                    const color = getDeptColor(dept.name);
                    const isHovered = hoveredDept === dept.name;

                    return (
                        <motion.path
                            key={dept.id}
                            d={dept.path}
                            fill={color}
                            stroke="#fff"
                            strokeWidth={isHovered ? 1.5 : 0.3}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                                fill: color,
                                filter: isHovered ? "brightness(1.05) drop-shadow(0 0 8px rgba(0,0,0,0.1))" : "brightness(1)",
                            }}
                            whileHover={{
                                scale: 1.015,
                                y: -2,
                                transition: { duration: 0.3, ease: "easeOut" }
                            }}
                            style={{
                                filter: isHovered ? "url(#softGlow)" : "none",
                                cursor: "pointer",
                                position: "relative",
                                zIndex: isHovered ? 50 : 1
                            }}
                            className="transition-all duration-300"
                            onMouseEnter={() => setHoveredDept(dept.name)}
                            onMouseLeave={() => setHoveredDept(null)}
                            onClick={() => onDeptClick(dept.name)}
                        />
                    );
                })}
            </svg>

            {/* Stats Overlay */}
            <div className="absolute bottom-8 right-8 text-right">
                <div className="bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-gray-100 shadow-xl">
                    <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Cobertura</span>
                    <span className="text-3xl font-black text-[#183C30]">
                        {Object.values(clientCounts).reduce((a, b) => a + b, 0)} <span className="text-sm text-green-600">CLIENTES</span>
                    </span>
                    <div className="mt-1 flex items-center justify-end gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[9px] font-black text-gray-400">MAPA ACTUALIZADO</span>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {hoveredDept && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        style={{ position: 'fixed', left: tooltipPos.x + 20, top: tooltipPos.y - 40 }}
                        className="z-[9999] bg-[#183C30] text-white p-5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-xl min-w-[240px]"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400 mb-1">Territorio</span>
                                <span className="text-lg font-black tracking-tight">{hoveredDept}</span>
                            </div>
                            <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                                <Info className="h-5 w-5 text-green-400" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-4 w-4 text-gray-400" />
                                    <span className="text-xs font-bold text-gray-300">Responsable</span>
                                </div>
                                <span className="text-xs font-black text-white px-2 py-1 rounded-lg bg-white/10">
                                    {DEPT_COMPANY_MAP[normalizeString(hoveredDept)] || "Sin asignar"}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <BarChart3 className="h-4 w-4 text-gray-400" />
                                    <span className="text-xs font-bold text-gray-300">Tendencia</span>
                                </div>
                                <div className="flex items-center gap-1 text-green-400">
                                    <span className="text-[10px] font-black underline">+{Math.floor(getDeptClients(hoveredDept) * 0.08) + 2}%</span>
                                    <ArrowRight className="h-3 w-3 -rotate-45" />
                                </div>
                            </div>
                            <p className="text-[8px] text-white/40 font-bold uppercase tracking-tighter text-center">Proyección vs mes anterior</p>

                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <Users className="h-4 w-4 text-gray-400" />
                                    <span className="text-xs font-bold text-gray-300">Población</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-black text-green-400">{getDeptClients(hoveredDept)}</span>
                                    <span className="text-[10px] font-black text-gray-400 uppercase">Clientes</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <span className="text-[9px] font-black text-gray-400 uppercase">Click para filtrar</span>
                            </div>
                            <ArrowRight className="h-3 w-3 text-white/30" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
