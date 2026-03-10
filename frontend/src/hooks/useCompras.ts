import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/config";
import { toast } from "sonner";
import { getAuthToken } from "./useAuth";

export interface Tercero {
    id: string;
    nombre: string;
    nit: string;
    correo: string;
    personaContacto: string;
    numeroContacto: string;
    insumos: string;
    insumosPrecios?: { insumoId: string, precio: number }[];
    created_at?: string;
}

export interface Insumo {
    id: string;
    sku: string;
    nombre: string;
    rendimiento: string;
    unidad: string;
    clasificacion?: string;
    proveedores?: string[];
    precio?: number;
    loteMinimo?: number;
    created_at?: string;
}

export interface BorradorMRP {
    id: string;
    nombre?: string;
    numeroPedido?: string;
    fechaSolicitada?: string;
    tiempoEntrega?: string;
    notas?: string;
    colchonSeguridad?: number;
    considerarStock?: boolean;
    considerarOCPendientes?: boolean;
    lineas?: { productoId: string; cantidad: number }[];
    cantidadesOverride?: Record<string, number>;
    proveedoresOverride?: Record<string, string>;
    empaquesSplit?: Record<string, Record<string, number>>;
    updated_at?: string;
    created_at?: string;
}
export interface OrdenItem {
    insumoId: string;
    insumo: string;
    cantidad: number;
    unidad: string;
    precio_estimado: number;
    cantidad_recibida?: number;
}

export interface DeliveryItem {
    insumoId: string;
    insumo: string;
    cantidad: number;
}

export interface Delivery {
    id: string;
    fecha: string;
    recibidoPor: string;
    documentoRef?: string;
    items: DeliveryItem[];
    notas?: string;
}

// Estados del flujo de aprobación de OC
export type EstadoOrden = "Borrador" | "Pendiente" | "Aprobada" | "Cancelada" | "Parcial" | "Recibido";

export interface OrdenCompra {
    id: string;
    terceroId: string;
    insumoId?: string;
    insumo: string;
    cantidad: number;
    unidad: string;
    tiempoEntrega?: string;
    precio_estimado?: number;
    estado: EstadoOrden;
    fechaMovimiento?: string;
    comprobanteUrl?: string;
    fechaSolicitada?: string;
    numeroPedido?: string;
    notas?: string;
    entregasParciales?: string;
    items?: OrdenItem[];
    historialEntregas?: Delivery[];
    total_bruto?: number;
    created_at?: string;
    // Flujo de aprobación
    aprobadoPor?: string;
    fechaAprobacion?: string;
    motivoRechazo?: string;
}

export interface ProductoFabricado {
    id: string;
    nombre: string;
    sku?: string;
    descripcion?: string;
    categoria?: string;
    tipo?: "Producto" | "Kit";
    insumosAsociados?: { insumoId: string; cantidadRequerida: number }[];
    productosAsociados?: { productoId: string; cantidadRequerida: number }[];
    created_at?: string;
}

// ── Helper para peticiones autenticadas ───────────────────────────────────────
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
}

// ── Tipos de error amigables ───────────────────────────────────────────────────
function friendlyError(e: unknown): string {
    if (e instanceof TypeError && e.message.includes("fetch")) {
        return "Sin conexión al servidor. Verifique que el backend esté activo.";
    }
    return "Error inesperado. Intente de nuevo.";
}

export function useCompras() {
    const queryClient = useQueryClient();

    // 1. Queries (FETCHING)
    const { data: terceros = [], isLoading: loadingTerceros, error: errorTerceros } = useQuery<Tercero[]>({
        queryKey: ['terceros'],
        queryFn: async () => {
            try {
                const res = await authFetch(`${API_URL}/api/compras/terceros`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                return json.data || [];
            } catch (e) {
                toast.error(`Proveedores: ${friendlyError(e)}`);
                throw e;
            }
        },
        retry: 2,
        retryDelay: 1500,
    });

    const { data: insumos = [], isLoading: loadingInsumos, error: errorInsumos } = useQuery<Insumo[]>({
        queryKey: ['insumos'],
        queryFn: async () => {
            try {
                const res = await authFetch(`${API_URL}/api/compras/insumos`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                return json.data || [];
            } catch (e) {
                toast.error(`Insumos: ${friendlyError(e)}`);
                throw e;
            }
        },
        retry: 2,
        retryDelay: 1500,
    });

    const { data: ordenes = [], isLoading: loadingOrdenes, error: errorOrdenes } = useQuery<OrdenCompra[]>({
        queryKey: ['ordenes'],
        queryFn: async () => {
            try {
                const res = await authFetch(`${API_URL}/api/compras/ordenes`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                return json.data || [];
            } catch (e) {
                toast.error(`Órdenes: ${friendlyError(e)}`);
                throw e;
            }
        },
        retry: 2,
        retryDelay: 1500,
    });

    const { data: productos = [], isLoading: loadingProductos, error: errorProductos } = useQuery<ProductoFabricado[]>({
        queryKey: ['productos'],
        queryFn: async () => {
            try {
                const res = await authFetch(`${API_URL}/api/compras/productos_fabricados`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                return json.data || [];
            } catch (e) {
                toast.error(`Productos: ${friendlyError(e)}`);
                throw e;
            }
        },
        retry: 2,
        retryDelay: 1500,
    });

    const isLoading = loadingTerceros || loadingInsumos || loadingOrdenes || loadingProductos;
    const hasError = !!(errorTerceros || errorInsumos || errorOrdenes || errorProductos);
    const error = hasError ? "Error al cargar datos — revisa tu conexión" : null;

    // 2. Mutations (CRUD con Optimistic Updates)

    // ORDENES
    const createOrdenMutation = useMutation({
        mutationFn: async (data: Partial<OrdenCompra>) => {
            const res = await authFetch(`${API_URL}/api/compras/ordenes`, {
                method: "POST",
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Error al crear");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ordenes'] });
            toast.success("Orden creada con éxito");
        },
        onError: () => toast.error("No se pudo crear la orden. Revisa tu conexión.")
    });

    const updateOrdenMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<OrdenCompra> }) => {
            const res = await authFetch(`${API_URL}/api/compras/ordenes/${id}`, {
                method: "PUT",
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error("Error al actualizar");
            return res.json();
        },
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: ['ordenes'] });
            const previous = queryClient.getQueryData(['ordenes']);
            queryClient.setQueryData(['ordenes'], (old: OrdenCompra[]) =>
                old?.map(o => o.id === id ? { ...o, ...updates } : o)
            );
            return { previous };
        },
        onError: (_err, _new, context) => {
            queryClient.setQueryData(['ordenes'], context?.previous);
            toast.error("Fallo al actualizar la orden.");
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['ordenes'] })
    });

    const deleteOrdenMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await authFetch(`${API_URL}/api/compras/ordenes/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Error al eliminar");
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['ordenes'] });
            const previous = queryClient.getQueryData(['ordenes']);
            queryClient.setQueryData(['ordenes'], (old: OrdenCompra[]) => old?.filter(o => o.id !== id));
            return { previous };
        },
        onError: (_err, _id, context) => {
            queryClient.setQueryData(['ordenes'], context?.previous);
            toast.error("Fallo al eliminar la orden.");
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['ordenes'] })
    });

    // TERCEROS
    const createTerceroMutation = useMutation({
        mutationFn: async (data: Partial<Tercero>) => {
            const res = await authFetch(`${API_URL}/api/compras/terceros`, {
                method: "POST",
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Fallo");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['terceros'] });
            toast.success("Proveedor registrado");
        }
    });

    const updateTerceroMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<Tercero> }) => {
            const res = await authFetch(`${API_URL}/api/compras/terceros/${id}`, {
                method: "PUT",
                body: JSON.stringify(updates)
            });
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['terceros'] })
    });

    const deleteTerceroMutation = useMutation({
        mutationFn: async (id: string) => {
            await authFetch(`${API_URL}/api/compras/terceros/${id}`, { method: "DELETE" });
            return id;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['terceros'] })
    });

    // INSUMOS
    const createInsumoMutation = useMutation({
        mutationFn: async (data: Partial<Insumo>) => {
            const res = await authFetch(`${API_URL}/api/compras/insumos`, {
                method: "POST",
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insumos'] })
    });

    const updateInsumoMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<Insumo> }) => {
            await authFetch(`${API_URL}/api/compras/insumos/${id}`, {
                method: "PUT",
                body: JSON.stringify(updates)
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insumos'] })
    });

    const deleteInsumoMutation = useMutation({
        mutationFn: async (id: string) => {
            await authFetch(`${API_URL}/api/compras/insumos/${id}`, { method: "DELETE" });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insumos'] })
    });

    // PRODUCTOS FABRICADOS
    const createProductoMutation = useMutation({
        mutationFn: async (data: Partial<ProductoFabricado>) => {
            const res = await authFetch(`${API_URL}/api/compras/productos_fabricados`, {
                method: "POST",
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] })
    });

    const updateProductoMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<ProductoFabricado> }) => {
            await authFetch(`${API_URL}/api/compras/productos_fabricados/${id}`, {
                method: "PUT",
                body: JSON.stringify(updates)
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] })
    });

    const deleteProductoMutation = useMutation({
        mutationFn: async (id: string) => {
            await authFetch(`${API_URL}/api/compras/productos_fabricados/${id}`, { method: "DELETE" });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] })
    });

    // 3. Facade functions usando mutateAsync para await correcto
    const createOrden = async (d: Partial<OrdenCompra>) => {
        try { await createOrdenMutation.mutateAsync(d); return true; } catch { return false; }
    };
    const updateOrden = async (id: string, u: Partial<OrdenCompra>) => {
        try { await updateOrdenMutation.mutateAsync({ id, updates: u }); return true; } catch { return false; }
    };
    const deleteOrden = async (id: string) => {
        try { await deleteOrdenMutation.mutateAsync(id); return true; } catch { return false; }
    };

    // ── Flujo de aprobación ──────────────────────────────────────────────────
    const aprobarOrden = async (id: string, aprobadoPor: string) => {
        return updateOrden(id, {
            estado: "Aprobada",
            aprobadoPor,
            fechaAprobacion: new Date().toISOString()
        });
    };

    const rechazarOrden = async (id: string, motivo: string) => {
        return updateOrden(id, {
            estado: "Cancelada",
            motivoRechazo: motivo
        });
    };

    const enviarParaAprobacion = async (id: string) => {
        return updateOrden(id, { estado: "Pendiente" });
    };

    const createTercero = async (d: Partial<Tercero>) => {
        try { await createTerceroMutation.mutateAsync(d); return true; } catch { return false; }
    };
    const updateTercero = async (id: string, u: Partial<Tercero>) => {
        try { await updateTerceroMutation.mutateAsync({ id, updates: u }); return true; } catch { return false; }
    };
    const deleteTercero = async (id: string) => {
        try { await deleteTerceroMutation.mutateAsync(id); return true; } catch { return false; }
    };

    const createInsumo = async (d: Partial<Insumo>) => {
        try { await createInsumoMutation.mutateAsync(d); return true; } catch { return false; }
    };
    const updateInsumo = async (id: string, u: Partial<Insumo>) => {
        try { await updateInsumoMutation.mutateAsync({ id, updates: u }); return true; } catch { return false; }
    };
    const deleteInsumo = async (id: string) => {
        try { await deleteInsumoMutation.mutateAsync(id); return true; } catch { return false; }
    };

    const createProducto = async (d: Partial<ProductoFabricado>) => {
        try { await createProductoMutation.mutateAsync(d); return true; } catch { return false; }
    };
    const updateProducto = async (id: string, u: Partial<ProductoFabricado>) => {
        try { await updateProductoMutation.mutateAsync({ id, updates: u }); return true; } catch { return false; }
    };
    const deleteProducto = async (id: string) => {
        try { await deleteProductoMutation.mutateAsync(id); return true; } catch { return false; }
    };

    return {
        terceros, insumos, ordenes, productos, isLoading, error, hasError,
        createTercero, updateTercero, deleteTercero,
        createInsumo, updateInsumo, deleteInsumo,
        createOrden, updateOrden, deleteOrden,
        aprobarOrden, rechazarOrden, enviarParaAprobacion,
        createProducto, updateProducto, deleteProducto,
        fetchData: () => queryClient.invalidateQueries({ queryKey: ['terceros', 'insumos', 'ordenes', 'productos'] })
    };
}
