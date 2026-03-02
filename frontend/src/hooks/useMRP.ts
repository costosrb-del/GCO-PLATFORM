import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BorradorMRP } from "./useCompras";
import { API_URL } from "@/lib/config";
import { getAuthToken } from "./useAuth";
import { toast } from "sonner";

async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(opts.headers as Record<string, string> || {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...opts, headers });
}

// ── OC Snapshot: cantidad en tránsito por insumoId ──────────────────────────
export function useOCSnapshot() {
    return useQuery<Record<string, number>>({
        queryKey: ["mrp_oc_snapshot"],
        queryFn: async () => {
            try {
                const res = await authFetch(`${API_URL}/api/compras/mrp/oc-snapshot`);
                if (!res.ok) return {};
                const json = await res.json();
                return json.data || {};
            } catch { return {}; }
        },
        staleTime: 30_000,
        retry: 1,
    });
}

// ── Stock del inventario: sku → cantidad ─────────────────────────────────────
export function useInventoryStock() {
    return useQuery<Record<string, number>>({
        queryKey: ["inventory_stock_snapshot"],
        queryFn: async () => {
            try {
                const res = await authFetch(`${API_URL}/api/inventario`);
                if (!res.ok) return {};
                const json = await res.json();
                const items: any[] = json.data || json || [];
                // Mapear sku → quantity (suma de todas las empresas)
                const map: Record<string, number> = {};
                for (const item of items) {
                    const sku = (item.sku || item.codigo || "").toUpperCase();
                    const qty = parseFloat(item.quantity ?? item.cantidad ?? 0);
                    if (sku) map[sku] = (map[sku] || 0) + qty;
                }
                return map;
            } catch { return {}; }
        },
        staleTime: 60_000,
        retry: 1,
    });
}

// ── Borradores MRP ───────────────────────────────────────────────────────────
export function useBorradores() {
    const qc = useQueryClient();

    const { data: borradores = [], isLoading } = useQuery<BorradorMRP[]>({
        queryKey: ["mrp_borradores"],
        queryFn: async () => {
            try {
                const res = await authFetch(`${API_URL}/api/compras/borradores`);
                if (!res.ok) return [];
                const json = await res.json();
                return json.data || [];
            } catch { return []; }
        },
        staleTime: 60_000,
    });

    const createMut = useMutation({
        mutationFn: async (data: Partial<BorradorMRP>) => {
            const res = await authFetch(`${API_URL}/api/compras/borradores`, {
                method: "POST",
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Error al guardar borrador");
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["mrp_borradores"] });
            toast.success("✅ Borrador guardado en Firestore");
        },
        onError: () => toast.error("No se pudo guardar el borrador"),
    });

    const updateMut = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<BorradorMRP> }) => {
            const res = await authFetch(`${API_URL}/api/compras/borradores/${id}`, {
                method: "PUT",
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Error al actualizar borrador");
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["mrp_borradores"] });
            toast.success("Borrador actualizado");
        },
    });

    const deleteMut = useMutation({
        mutationFn: async (id: string) => {
            await authFetch(`${API_URL}/api/compras/borradores/${id}`, { method: "DELETE" });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["mrp_borradores"] });
            toast.success("Borrador eliminado");
        },
    });

    const saveBorrador = async (data: Partial<BorradorMRP>) => {
        try { await createMut.mutateAsync(data); return true; } catch { return false; }
    };

    const updateBorrador = async (id: string, data: Partial<BorradorMRP>) => {
        try { await updateMut.mutateAsync({ id, data }); return true; } catch { return false; }
    };

    const deleteBorrador = async (id: string) => {
        try { await deleteMut.mutateAsync(id); return true; } catch { return false; }
    };

    return { borradores, isLoading, saveBorrador, updateBorrador, deleteBorrador };
}
