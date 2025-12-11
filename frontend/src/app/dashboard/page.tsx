import { Zap } from "lucide-react";

export default function DashboardHome() {
  return (
    <div className="p-8">
      <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
        <div className="h-20 w-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
           <Zap className="h-10 w-10 text-[#183C30]" />
        </div>
        <h1 className="text-3xl font-bold text-[#183C30] mb-2">¡Sistema Operativo!</h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Bienvenido al nuevo panel de control. Selecciona una opción del menú lateral para comenzar.
        </p>
      </div>
    </div>
  );
}
