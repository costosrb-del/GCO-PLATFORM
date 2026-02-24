"use client";

import Link from "next/link";
import { Package, Truck, History, ClipboardList, UserPlus, FileSpreadsheet, FileCheck, Settings, Users, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/hooks/useTasks";
import { isToday, isPast, addDays } from "date-fns";

export default function DashboardHome() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  // Custom hook for tasks
  const { tasks, isLoading } = useTasks();

  useEffect(() => {
    const storedRole = localStorage.getItem("gco_role");
    setRole(storedRole);

    if (storedRole === "asesora") {
      router.replace("/dashboard/asesoras");
    }
  }, [router]);

  if (role === "asesora") return null;

  // Process Task Stats
  const activeTasks = tasks.filter(t => t.status !== "Completada" && t.status !== "Cancelada");
  const pendingCount = activeTasks.filter(t => t.status === "Pendiente").length;
  const inProgressCount = activeTasks.filter(t => t.status === "En Progreso").length;

  let overdueCount = 0;
  let dueTodayCount = 0;

  activeTasks.forEach(task => {
    if (task.due_date) {
      const date = new Date(task.due_date + 'T00:00:00');
      if (isToday(date)) dueTodayCount++;
      else if (isPast(addDays(date, 1))) overdueCount++;
    }
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#183C30]">
            Bienvenido a GCO Platform
          </h1>
          <p className="text-gray-500 mt-1">
            Panel de control principal. Seleccione una herramienta o revise su progreso.
          </p>
        </div>
      </div>

      {/* Widget Tareas Resumen */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-[#183C30]/10 text-[#183C30] rounded-xl flex items-center justify-center shrink-0">
            <ClipboardList className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Estado de Operaciones</h2>
            <p className="text-sm text-gray-500">Resumen rápido de sus tareas asignadas y estatus de trabajo.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {isLoading ? (
            <div className="text-sm text-gray-400 italic">Cargando métricas...</div>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg flex flex-col min-w-[100px]">
                <span className="text-xs text-gray-500 font-bold mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> Pendientes</span>
                <span className="text-xl font-black text-gray-700">{pendingCount}</span>
              </div>
              <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-lg flex flex-col min-w-[100px]">
                <span className="text-xs text-blue-600 font-bold mb-0.5 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> En Progreso</span>
                <span className="text-xl font-black text-blue-700">{inProgressCount}</span>
              </div>
              {(overdueCount > 0 || dueTodayCount > 0) && (
                <div className="bg-red-50 border border-red-100 px-4 py-2 rounded-lg flex flex-col min-w-[100px]">
                  <span className="text-xs text-red-600 font-bold mb-0.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Urgentes</span>
                  <div className="text-sm font-medium text-red-700 flex items-center gap-2">
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

      <h2 className="text-lg font-bold text-gray-800 border-b pb-2">Servicios y Módulos Disponibles</h2>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">

        {/* Gestor Tareas */}
        <Link href="/dashboard/tareas" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/30 relative overflow-hidden">
          <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Tareas & Operaciones</h3>
            <p className="text-xs text-gray-500 mt-1 leading-snug">Kanban, agendas recurrentes y métricas de trabajo.</p>
          </div>
        </Link>

        {/* Clientes */}
        <Link href="/dashboard/asesoras" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/30 relative overflow-hidden">
          <div className="h-12 w-12 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Gestión de Clientes</h3>
            <p className="text-xs text-gray-500 mt-1 leading-snug">Control de cartera, información de asesores y mapa.</p>
          </div>
        </Link>

        {/* Inventario */}
        <Link href="/dashboard/saldos" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/30 relative overflow-hidden">
          <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Saldos de Inventario</h3>
            <p className="text-xs text-gray-500 mt-1 leading-snug">Ver stock actual, histórico valorizado y cruces de bodegas.</p>
          </div>
        </Link>

        {/* Auditoría */}
        <Link href="/dashboard/movements" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/30 relative overflow-hidden">
          <div className="h-12 w-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Auditoría de Movimientos</h3>
            <p className="text-xs text-gray-500 mt-1 leading-snug">Trazabilidad detallada de documentos (FC, FV, RM, NC).</p>
          </div>
        </Link>

        {/* Distribucion */}
        <Link href="/dashboard/distribucion" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/30 relative overflow-hidden">
          <div className="h-12 w-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Distribución Inteligente</h3>
            <p className="text-xs text-gray-500 mt-1 leading-snug">Algoritmo de reabastecimiento óptimo entre sucursales.</p>
          </div>
        </Link>

        {/* Transporte */}
        <Link href="/dashboard/transporte" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/30 relative overflow-hidden">
          <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Gestión de Transporte</h3>
            <p className="text-xs text-gray-500 mt-1 leading-snug">Rutas, despachos y control logístico de la flota.</p>
          </div>
        </Link>

        {/* Juego Inventarios */}
        <Link href="/dashboard/juego-inventarios" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/30 relative overflow-hidden">
          <div className="h-12 w-12 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Juego de Inventarios</h3>
            <p className="text-xs text-gray-500 mt-1 leading-snug">Análisis matricial para cruzar stock y calcular diferencias.</p>
          </div>
        </Link>

        {/* Actas Cierre */}
        <Link href="/dashboard/cierre-actas" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/30 relative overflow-hidden">
          <div className="h-12 w-12 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Actas de Cierre</h3>
            <p className="text-xs text-gray-500 mt-1 leading-snug">Validación y guardado oficial en PDF de cierres de mes.</p>
          </div>
        </Link>

        {/* Usuarios (Admin) */}
        {role === "admin" && (
          <Link href="/dashboard/ajustes/usuarios" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-4 hover:border-[#183C30]/30 relative overflow-hidden">
            <div className="h-12 w-12 bg-gray-50 text-gray-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-[15px]">Panel de Usuarios</h3>
              <p className="text-xs text-gray-500 mt-1 leading-snug">Administración de credenciales y controles de acceso.</p>
            </div>
          </Link>
        )}

      </div>
    </div>
  );
}
