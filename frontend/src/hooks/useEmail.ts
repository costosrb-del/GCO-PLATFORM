/**
 * useEmail.ts
 * Hook para enviar OC por email al proveedor.
 * Genera el PDF en el frontend (blob → base64) y llama al backend /email/enviar-oc.
 */

import { useState } from "react";
import { OrdenCompra, Tercero, Insumo } from "./useCompras";
import { generarPDFOrdenBlob } from "@/app/dashboard/compras/utils/pdfExport";
import { getAuth } from "firebase/auth";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getToken(): Promise<string> {
    const user = getAuth().currentUser;
    if (!user) throw new Error("No autenticado");
    return user.getIdToken();
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // result = "data:application/pdf;base64,XXXX..." → solo la parte base64
            const b64 = (reader.result as string).split(",")[1];
            resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export interface EnviarEmailPayload {
    orden: OrdenCompra;
    tercero: Tercero;
    insumos: Insumo[];
    ccEmails: string[];   // correos adicionales en copia
}

export function useEmail() {
    const [enviando, setEnviando] = useState(false);

    const enviarOC = async ({
        orden, tercero, insumos, ccEmails,
    }: EnviarEmailPayload): Promise<boolean> => {
        setEnviando(true);
        try {
            // 1. Generar PDF blob en el frontend
            const pdfBlob = generarPDFOrdenBlob(orden, tercero, insumos);
            const pdfBase64 = await blobToBase64(pdfBlob);

            // 2. Llamar al backend
            const token = await getToken();
            const body = {
                oc_id: orden.id,
                numero_pedido: orden.numeroPedido ?? "",
                correo_proveedor: tercero.correo,
                nombre_proveedor: tercero.nombre,
                nit_proveedor: tercero.nit,
                correo_cc: ccEmails.filter(Boolean),
                fecha_solicitada: orden.fechaSolicitada ?? null,
                tiempo_entrega: orden.tiempoEntrega ?? null,
                notas: orden.notas ?? null,
                items: (orden.items ?? []).map(it => ({
                    insumo: it.insumo,
                    cantidad: it.cantidad,
                    unidad: it.unidad,
                    precio_estimado: it.precio_estimado ?? 0,
                })),
                total_bruto: orden.total_bruto ?? (orden.cantidad ?? 0) * (orden.precio_estimado ?? 0),
                pdf_base64: pdfBase64,
            };

            const res = await fetch(`${API_BASE}/email/enviar-oc`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
                throw new Error(err.detail ?? "Error del servidor");
            }

            const data = await res.json();
            toast.success(`📧 Email enviado a ${data.destinatarios.join(", ")}`);
            return true;
        } catch (err: any) {
            toast.error(`Error al enviar email: ${err.message}`);
            return false;
        } finally {
            setEnviando(false);
        }
    };

    return { enviarOC, enviando };
}
