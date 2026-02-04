
"use client";

import { Construction, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MovementsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 space-y-6 text-center">
      <div className="h-24 w-24 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-4">
        <Construction className="h-12 w-12" />
      </div>

      <h1 className="text-3xl font-bold text-gray-900">
        Módulo en Mantenimiento
      </h1>

      <p className="text-gray-500 max-w-md mx-auto text-lg">
        Estamos optimizando la auditoría de movimientos para mejorar el rendimiento y reducir costos.
        Este módulo estará disponible próximamente.
      </p>

      <div className="flex gap-4 pt-4">
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-[#183C30] text-white rounded-xl font-medium hover:bg-[#122e24] transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Inicio
        </Link>
      </div>
    </div>
  );
}
