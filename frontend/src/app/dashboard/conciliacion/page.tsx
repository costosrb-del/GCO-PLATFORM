import { ConciliacionSection } from "./components/ConciliacionSection";

export const metadata = {
    title: "Conciliación FVs | GCO Platform",
    description: "Conciliación de Facturas de Venta con Google Sheets",
};

export default function ConciliacionPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">
                    Conciliación de Facturas
                </h1>
                <p className="text-gray-500 font-medium">
                    Verifica que las Facturas de Venta emitidas en Siigo coincidan con los reportes de Google Sheets.
                </p>
            </div>

            <ConciliacionSection />
        </div>
    );
}
