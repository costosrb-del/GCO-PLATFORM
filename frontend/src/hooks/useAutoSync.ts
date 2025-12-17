
"use client";

import { useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";

import { API_URL } from "@/lib/config";

const getBaseUrl = () => {
    return API_URL;
};

export function useAutoSync() {
    const hasSynced = useRef(false);

    useEffect(() => {
        if (hasSynced.current) return;

        const syncData = async () => {
            try {
                const token = localStorage.getItem("gco_token");
                if (!token) return;

                const currentYear = new Date().getFullYear();
                console.log(`[AutoSync] Iniciando sincronización silenciosa para ${currentYear}...`);

                // Fire and forget (don't await response to block UI, but we want to know if it fails)
                axios.post(
                    `${getBaseUrl()}/movements/sync`,
                    { years: [currentYear] },
                    { headers: { Authorization: `Bearer ${token}` } }
                ).then((res) => {
                    console.log("[AutoSync] Completado.", res.data);
                    // Optional: Toast message? "Datos actualizados"
                    // toast.success("Datos actualizados correctamente.");
                }).catch((err) => {
                    console.error("[AutoSync] Falló en segundo plano:", err);
                });

                hasSynced.current = true;
            } catch (error) {
                console.error("[AutoSync] Error crítico:", error);
            }
        };

        syncData();
    }, []);
}
