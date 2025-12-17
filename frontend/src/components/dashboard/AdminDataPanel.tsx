
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Database, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

import { API_URL } from "@/lib/config";

const getBaseUrl = () => {
    return API_URL;
};

export function AdminDataPanel() {
    const [isSyncing, setIsSyncing] = useState(false);
    const currentYear = new Date().getFullYear();
    const availableYears = [currentYear, currentYear - 1]; // Sync current and last year

    const handleSync = async (year: number) => {
        try {
            setIsSyncing(true);
            const token = localStorage.getItem("gco_token");
            if (!token) throw new Error("No autenticado");

            toast.info(`Iniciando sincronización para ${year}. Esto puede tardar...`);

            const { data } = await axios.post(
                `${getBaseUrl()}/movements/sync`,
                { years: [year] },
                { headers: { Authorization: `Bearer ${token}` }, timeout: 600000 } // 10 min timeout
            );

            toast.success("Sincronización completada. Verifica los detalles en consola.", {
                description: JSON.stringify(data.details)
            });
            console.log("Sync details:", data);

        } catch (error: any) {
            console.error(error);
            toast.error("Error en sincronización", {
                description: error.response?.data?.detail || error.message
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Card className="border-blue-100 bg-blue-50/30">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                    <Database className="h-5 w-5" />
                    Administración de Datos
                </CardTitle>
                <CardDescription>
                    Carga inicial de histórico (Data Warehouse). Ejecutar solo si faltan datos antiguos.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
                {availableYears.map(year => (
                    <Button
                        key={year}
                        variant="outline"
                        className="bg-white hover:bg-blue-50 border-blue-200 text-blue-700"
                        onClick={() => handleSync(year)}
                        disabled={isSyncing}
                    >
                        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Sincronizar {year}
                    </Button>
                ))}
            </CardContent>
        </Card>
    );
}
