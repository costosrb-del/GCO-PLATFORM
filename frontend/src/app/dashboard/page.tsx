"use client";

import Link from "next/link";
import {
  Package, Truck, History, ClipboardList, UserPlus,
  FileSpreadsheet, FileCheck, Settings, Users, AlertCircle,
  Clock, CheckCircle2, ShoppingCart, TrendingUp, DollarSign,
  Search, X, Moon, Sun, RefreshCw, Building2, FileText
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/hooks/useTasks";
import { useCompras } from "@/hooks/useCompras";
import { useAuth } from "@/hooks/useAuth";
import { isToday, isPast, addDays } from "date-fns";
import { API_URL } from "@/lib/config";

// ── Tipo de KPIs de compras ────────────────────────────────────────────────
interface ComprasKPIs {
  total_ordenes: number;
  pendientes: number;
  aprobadas: number;
  recibidas: number;
  parciales: number;
  total_proveedores: number;
  inversion_total: number;
  inversion_pendiente: number;
}

// ── Módulos del sistema ────────────────────────────────────────────────────
const MODULES = [
  { href: "/dashboard/tareas", label: "Tareas & Operaciones", desc: "Kanban, agendas y métricas de trabajo.", icon: ClipboardList, color: "purple" },
  { href: "/dashboard/asesoras", label: "Gestión de Clientes", desc: "Cartera, asesores y mapa zonal.", icon: UserPlus, color: "pink" },
  { href: "/dashboard/saldos", label: "Saldos de Inventario", desc: "Stock actual, histórico y cruces de bodegas.", icon: Package, color: "blue" },
  { href: "/dashboard/movements", label: "Auditoría de Movimientos", desc: "Trazabilidad de FC, FV, RM, NC.", icon: History, color: "orange" },
  { href: "/dashboard/distribucion", label: "Distribución Inteligente", desc: "Reabastecimiento óptimo entre sucursales.", icon: Truck, color: "green" },
  { href: "/dashboard/transporte", label: "Gestión de Transporte", desc: "Rutas, despachos y control de flota.", icon: Truck, color: "indigo" },
  { href: "/dashboard/juego-inventarios", label: "Juego de Inventarios", desc: "Análisis matricial para cruzar stock.", icon: FileSpreadsheet, color: "cyan" },
  { href: "/dashboard/cierre-actas", label: "Actas de Cierre", desc: "Validación y guardado oficial de cierres.", icon: FileCheck, color: "yellow" },
  { href: "/dashboard/compras", label: "Gestión de Compras", desc: "OC, proveedores e insumos.", icon: ShoppingCart, color: "emerald" },
];

const colorMap: Record<string, string> = {
  purple: "bg-purple-50 text-purple-600",
  pink: "bg-pink-50 text-pink-600",
  blue: "bg-blue-50 text-blue-600",
  orange: "bg-orange-50 text-orange-600",
  green: "bg-green-50 text-green-600",
  indigo: "bg-indigo-50 text-indigo-600",
  cyan: "bg-cyan-50 text-cyan-600",
  yellow: "bg-yellow-50 text-yellow-600",
  emerald: "bg-emerald-50 text-emerald-600",
};

export default function DashboardHome() {
  const router = useRouter();
  const { role, isLoading: authLoading } = useAuth();
  const { tasks, isLoading: tasksLoading } = useTasks();
  const { ordenes, isLoading: comprasLoading } = useCompras();

  const [darkMode, setDarkMode] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [kpisCompras, setKpisCompras] = useState<ComprasKPIs | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Modo oscuro ────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("gco_dark") === "1";
    setDarkMode(saved);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("gco_dark", darkMode ? "1" : "0");
  }, [darkMode]);

  // ── Atajos de teclado ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setShowSearch(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── KPIs de compras desde backend ─────────────────────────────────────
  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const res = await fetch(`${API_URL}/api/compras/kpis`);
        if (res.ok) setKpisCompras(await res.json());
      } catch { /* silenciar —  no bloquear el dashboard */ }
      finally { setKpisLoading(false); }
    };
    fetchKpis();
  }, []);

  // ── Redirigir asesoras ────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && role === "asesora") router.replace("/dashboard/asesoras");
  }, [role, authLoading, router]);

  if (authLoading || role === "asesora") return null;

  // ── Stats de tareas ────────────────────────────────────────────────────
  const activeTasks = tasks.filter(t => t.status !== "Completada" && t.status !== "Cancelada");
  const pendingCount = activeTasks.filter(t => t.status === "Pendiente").length;
  const inProgressCount = activeTasks.filter(t => t.status === "En Progreso").length;
  let overdueCount = 0, dueTodayCount = 0;
  activeTasks.forEach(task => {
    if (task.due_date) {
      const date = new Date(task.due_date + "T00:00:00");
      if (isToday(date)) dueTodayCount++;
      else if (isPast(addDays(date, 1))) overdueCount++;
    }
  });

  // ── Búsqueda de módulos ────────────────────────────────────────────────
  const filteredModules = MODULES.filter(m =>
    m.label.toLowerCase().includes(search.toLowerCase()) ||
    m.desc.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n: number) => n.toLocaleString("es-CO");
  const fmtMoney = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

  return (
    <div className={`p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 ${darkMode ? "dark" : ""}`}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#183C30] dark:text-emerald-400">
            GCO Platform
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Panel de control principal · {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Búsqueda global */}
          <button
            onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50); }}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-400 hover:border-[#183C30] hover:text-[#183C30] transition-all shadow-sm"
            title="Búsqueda global (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
            <span className="hidden md:inline">Buscar módulo...</span>
            <kbd className="hidden md:inline text-[10px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">Ctrl+K</kbd>
          </button>
          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(d => !d)}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-300 hover:border-[#183C30] transition-all shadow-sm"
            title={darkMode ? "Modo claro" : "Modo oscuro"}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Modal búsqueda global ─────────────────────────────────────────── */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-24 px-4" onClick={() => setShowSearch(false)}>
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-slate-700">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar módulo o función..."
                className="flex-1 bg-transparent text-lg outline-none text-gray-800 dark:text-white placeholder-gray-400"
              />
              <button onClick={() => setShowSearch(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-800">
              {filteredModules.length === 0 ? (
                <p className="p-6 text-center text-gray-400 text-sm">No se encontraron módulos</p>
              ) : filteredModules.map(m => (
                <Link key={m.href} href={m.href} onClick={() => setShowSearch(false)}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <div className={`h-10 w-10 ${colorMap[m.color]} rounded-xl flex items-center justify-center shrink-0`}>
                    <m.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white text-sm">{m.label}</p>
                    <p className="text-xs text-gray-400">{m.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs cruzados ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {/* Tareas activas */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tareas Activas</p>
              {tasksLoading ? <div className="h-8 w-16 bg-gray-100 dark:bg-slate-700 animate-pulse rounded" /> :
                <p className="text-3xl font-black text-gray-900 dark:text-white">{pendingCount + inProgressCount}</p>}
              <p className="text-xs text-gray-400 mt-1">{pendingCount} pendientes · {inProgressCount} en curso</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 p-2.5 rounded-xl">
              <ClipboardList className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          {overdueCount > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg w-fit">
              <AlertCircle className="w-3 h-3" /> {overdueCount} vencidas
            </div>
          )}
        </div>

        {/* OC Pendientes */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">OC Pendientes</p>
              {kpisLoading ? <div className="h-8 w-16 bg-gray-100 dark:bg-slate-700 animate-pulse rounded" /> :
                <p className="text-3xl font-black text-amber-600">{kpisCompras?.pendientes ?? 0}</p>}
              <p className="text-xs text-gray-400 mt-1">{kpisCompras?.aprobadas ?? 0} aprobadas</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/30 p-2.5 rounded-xl">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Inversión en curso */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Inversión en Curso</p>
              {kpisLoading ? <div className="h-8 w-24 bg-gray-100 dark:bg-slate-700 animate-pulse rounded" /> :
                <p className="text-2xl font-black text-[#183C30] dark:text-emerald-400">{fmtMoney(kpisCompras?.inversion_pendiente ?? 0)}</p>}
              <p className="text-xs text-gray-400 mt-1">Total: {fmtMoney(kpisCompras?.inversion_total ?? 0)}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/30 p-2.5 rounded-xl">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Proveedores */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Proveedores</p>
              {kpisLoading ? <div className="h-8 w-12 bg-gray-100 dark:bg-slate-700 animate-pulse rounded" /> :
                <p className="text-3xl font-black text-blue-600">{kpisCompras?.total_proveedores ?? 0}</p>}
              <p className="text-xs text-gray-400 mt-1">{kpisCompras?.recibidas ?? 0} OC completadas</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-2.5 rounded-xl">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Widget Tareas Resumen ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-[#183C30]/10 text-[#183C30] dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
            <ClipboardList className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Estado de Operaciones</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Resumen rápido de tareas asignadas y estatus de trabajo.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {tasksLoading ? (
            <div className="text-sm text-gray-400 italic">Cargando...</div>
          ) : (
            <>
              <div className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-4 py-2 rounded-lg flex flex-col min-w-[100px]">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> Pendientes</span>
                <span className="text-xl font-black text-gray-700 dark:text-white">{pendingCount}</span>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-4 py-2 rounded-lg flex flex-col min-w-[100px]">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-0.5 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> En Progreso</span>
                <span className="text-xl font-black text-blue-700 dark:text-blue-300">{inProgressCount}</span>
              </div>
              {(overdueCount > 0 || dueTodayCount > 0) && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-4 py-2 rounded-lg flex flex-col min-w-[100px]">
                  <span className="text-xs text-red-600 dark:text-red-400 font-bold mb-0.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Urgentes</span>
                  <div className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                    {overdueCount > 0 && <span><b className="text-lg">{overdueCount}</b> Vencidas</span>}
                    {dueTodayCount > 0 && <span><b className="text-lg">{dueTodayCount}</b> Hoy</span>}
                  </div>
                </div>
              )}
              <Link href="/dashboard/tareas" className="bg-[#183C30] text-white px-4 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-[#122e24] transition-colors ml-auto md:ml-2">
                Ir al Workspace
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Módulos ────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 border-b dark:border-slate-700 pb-2 mb-4">
          Servicios y Módulos Disponibles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
          {MODULES.map(m => (
            <Link key={m.href} href={m.href}
              className="group p-5 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/40 dark:hover:border-emerald-600/40 relative overflow-hidden">
              <div className={`h-12 w-12 ${colorMap[m.color]} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <m.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-[15px]">{m.label}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{m.desc}</p>
              </div>
              <div className="absolute bottom-0 right-0 w-16 h-16 rounded-full bg-gray-50 dark:bg-slate-700/50 -mr-6 -mb-6 group-hover:scale-150 transition-transform duration-500" />
            </Link>
          ))}

          {/* Admin: Panel de usuarios */}
          {role === "admin" && (
            <Link href="/dashboard/ajustes/usuarios"
              className="group p-5 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/40">
              <div className="h-12 w-12 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-[15px]">Panel de Usuarios</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">Administración de credenciales y roles de acceso.</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
