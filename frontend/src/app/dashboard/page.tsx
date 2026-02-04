
"use client";

import Link from "next/link";
import { Package, Truck, FileBarChart, History } from "lucide-react";

export default function DashboardHome() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#183C30]">
            Bienvenido a GCO Platform
          </h1>
          <p className="text-gray-500 mt-1">
            Seleccione una herramienta para comenzar.
          </p>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Inventario */}
        <Link
          href="/dashboard/saldos"
          className="group p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-4 hover:border-[#183C30]/20"
        >
          <div className="h-14 w-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <Package className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Inventario y Saldos</h3>
            <p className="text-sm text-gray-500 mt-1">
              Ver stock actual, histórico y valorizado.
            </p>
          </div>
        </Link>

        {/* Auditoría */}
        <Link
          href="/dashboard/movements"
          className="group p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-4 hover:border-[#183C30]/20"
        >
          <div className="h-14 w-14 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <History className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Auditoría de Movimientos</h3>
            <p className="text-sm text-gray-500 mt-1">
              Trazabilidad detallada de documentos.
            </p>
          </div>
        </Link>

        {/* Distribucion */}
        <Link
          href="/dashboard/distribucion"
          className="group p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-4 hover:border-[#183C30]/20"
        >
          <div className="h-14 w-14 bg-green-50 text-green-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <Truck className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Distribución Inteligente</h3>
            <p className="text-sm text-gray-500 mt-1">
              Reabastecimiento entre bodegas.
            </p>
          </div>
        </Link>

      </div>
    </div>
  );
}
