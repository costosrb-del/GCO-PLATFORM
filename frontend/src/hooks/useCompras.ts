import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/config";
import { toast } from "sonner";
import { useMemo } from "react";

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
    items: DeliveryItem[];
    notas?: string;
}

export interface OrdenCompra {
    id: string;
    terceroId: string;
    insumoId?: string;
    insumo: string;
    cantidad: number;
    unidad: string;
    tiempoEntrega?: string;
    precio_estimado?: number;
    estado: string; // Pendiente, Recibido, Cancelado
    fechaMovimiento?: string;
    comprobanteUrl?: string;
    fechaSolicitada?: string;
    numeroPedido?: string;
    notas?: string;
    entregasParciales?: string;
    items?: OrdenItem[];
    historialEntregas?: Delivery[]; // Nuevo campo para control de entregas
    total_bruto?: number;
    created_at?: string;
}

export interface ProductoFabricado {
    id: string;
    nombre: string;
    sku?: string;
    descripcion?: string;
    categoria?: string;
    insumosAsociados?: { insumoId: string; cantidadRequerida: number }[];
    created_at?: string;
}

export function useCompras() {
    const queryClient = useQueryClient();

    // 1. Queries (FETCHING)
    const { data: terceros = [], isLoading: loadingTerceros, error: errorTerceros } = useQuery<Tercero[]>({
        queryKey: ['terceros'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/compras/terceros`);
            const json = await res.json();
            return json.data || [];
        }
    });

    const { data: insumos = [], isLoading: loadingInsumos, error: errorInsumos } = useQuery<Insumo[]>({
        queryKey: ['insumos'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/compras/insumos`);
            const json = await res.json();
            return json.data || [];
        }
    });

    const { data: ordenes = [], isLoading: loadingOrdenes, error: errorOrdenes } = useQuery<OrdenCompra[]>({
        queryKey: ['ordenes'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/compras/ordenes`);
            const json = await res.json();
            return json.data || [];
        }
    });

    const { data: productos = [], isLoading: loadingProductos, error: errorProductos } = useQuery<ProductoFabricado[]>({
        queryKey: ['productos'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/compras/productos_fabricados`);
            const json = await res.json();
            return json.data || [];
        }
    });

    const isLoading = loadingTerceros || loadingInsumos || loadingOrdenes || loadingProductos;
    const error = errorTerceros || errorInsumos || errorOrdenes || errorProductos ? "Error al cargar datos" : null;

    // 2. Mutations (CRUD con Optimistic Updates)

    // ORDENES
    const createOrdenMutation = useMutation({
        mutationFn: async (data: Partial<OrdenCompra>) => {
            const res = await fetch(`${API_URL}/api/compras/ordenes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Error al crear");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ordenes'] });
            toast.success("Orden creada con éxito");
        }
    });

    const updateOrdenMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<OrdenCompra> }) => {
            const res = await fetch(`${API_URL}/api/compras/ordenes/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
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
            toast.error("Fallo al actualizar");
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['ordenes'] })
    });

    const deleteOrdenMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_URL}/api/compras/ordenes/${id}`, { method: "DELETE" });
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
            toast.error("Fallo al eliminar");
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['ordenes'] })
    });

    // TERCEROS
    const createTerceroMutation = useMutation({
        mutationFn: async (data: Partial<Tercero>) => {
            const res = await fetch(`${API_URL}/api/compras/terceros`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
            const res = await fetch(`${API_URL}/api/compras/terceros/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['terceros'] })
    });

    const deleteTerceroMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch(`${API_URL}/api/compras/terceros/${id}`, { method: "DELETE" });
            return id;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['terceros'] })
    });

    // INSUMOS
    const createInsumoMutation = useMutation({
        mutationFn: async (data: Partial<Insumo>) => {
            const res = await fetch(`${API_URL}/api/compras/insumos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insumos'] })
    });

    const updateInsumoMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<Insumo> }) => {
            await fetch(`${API_URL}/api/compras/insumos/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insumos'] })
    });

    const deleteInsumoMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch(`${API_URL}/api/compras/insumos/${id}`, { method: "DELETE" });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insumos'] })
    });

    // PRODUCTOS FABRICADOS
    const createProductoMutation = useMutation({
        mutationFn: async (data: Partial<ProductoFabricado>) => {
            const res = await fetch(`${API_URL}/api/compras/productos_fabricados`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] })
    });

    const updateProductoMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<ProductoFabricado> }) => {
            await fetch(`${API_URL}/api/compras/productos_fabricados/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] })
    });

    const deleteProductoMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch(`${API_URL}/api/compras/productos_fabricados/${id}`, { method: "DELETE" });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] })
    });

    // 3. Facade functions to match old API
    const createOrden = async (d: Partial<OrdenCompra>) => { createOrdenMutation.mutate(d); return true; };
    const updateOrden = async (id: string, u: Partial<OrdenCompra>) => { updateOrdenMutation.mutate({ id, updates: u }); return true; };
    const deleteOrden = async (id: string) => { deleteOrdenMutation.mutate(id); return true; };

    const createTercero = async (d: Partial<Tercero>) => { createTerceroMutation.mutate(d); return true; };
    const updateTercero = async (id: string, u: Partial<Tercero>) => { updateTerceroMutation.mutate({ id, updates: u }); return true; };
    const deleteTercero = async (id: string) => { deleteTerceroMutation.mutate(id); return true; };

    const createInsumo = async (d: Partial<Insumo>) => { createInsumoMutation.mutate(d); return true; };
    const updateInsumo = async (id: string, u: Partial<Insumo>) => { updateInsumoMutation.mutate({ id, updates: u }); return true; };
    const deleteInsumo = async (id: string) => { deleteInsumoMutation.mutate(id); return true; };

    const createProducto = async (d: Partial<ProductoFabricado>) => { createProductoMutation.mutate(d); return true; };
    const updateProducto = async (id: string, u: Partial<ProductoFabricado>) => { updateProductoMutation.mutate({ id, updates: u }); return true; };
    const deleteProducto = async (id: string) => { deleteProductoMutation.mutate(id); return true; };

    return {
        terceros, insumos, ordenes, productos, isLoading, error,
        createTercero, updateTercero, deleteTercero,
        createInsumo, updateInsumo, deleteInsumo,
        createOrden, updateOrden, deleteOrden,
        createProducto, updateProducto, deleteProducto,
        fetchData: () => queryClient.invalidateQueries({ queryKey: ['terceros', 'insumos', 'ordenes', 'productos'] })
    };
}
