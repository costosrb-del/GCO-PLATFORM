import { useState, useEffect } from "react";
import { API_URL } from "@/lib/config";

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
    const [terceros, setTerceros] = useState<Tercero[]>([]);
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
    const [productos, setProductos] = useState<ProductoFabricado[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async (background = false) => {
        if (!background) setIsLoading(true);
        try {
            const [tercerosRes, insumosRes, ordenesRes, productosRes] = await Promise.all([
                fetch(`${API_URL}/api/compras/terceros`),
                fetch(`${API_URL}/api/compras/insumos`),
                fetch(`${API_URL}/api/compras/ordenes`),
                fetch(`${API_URL}/api/compras/productos_fabricados`)
            ]);

            if (!tercerosRes.ok || !ordenesRes.ok || !insumosRes.ok) throw new Error("Error fetching data");

            const tercerosData = await tercerosRes.json();
            const insumosData = await insumosRes.json();
            const ordenesData = await ordenesRes.json();
            const productosData = await productosRes.json();

            setTerceros(tercerosData.data || []);
            setInsumos(insumosData.data || []);
            setOrdenes(ordenesData.data || []);
            setProductos(productosData.data || []);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            if (!background) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const createTercero = async (data: Partial<Tercero>) => {
        try {
            const res = await fetch(`${API_URL}/api/compras/terceros`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create tercero");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const updateTercero = async (id: string, updates: Partial<Tercero>) => {
        try {
            const res = await fetch(`${API_URL}/api/compras/terceros/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error("Failed to update tercero");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const deleteTercero = async (id: string) => {
        try {
            const res = await fetch(`${API_URL}/api/compras/terceros/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete tercero");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const createOrden = async (data: Partial<OrdenCompra>) => {
        try {
            const res = await fetch(`${API_URL}/api/compras/ordenes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create orden");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const updateOrden = async (id: string, updates: Partial<OrdenCompra>) => {
        setOrdenes(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
        try {
            const res = await fetch(`${API_URL}/api/compras/ordenes/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error("Failed to update orden");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            await fetchData(true);
            return false;
        }
    };

    const deleteOrden = async (id: string) => {
        try {
            const res = await fetch(`${API_URL}/api/compras/ordenes/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete orden");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const createInsumo = async (data: Partial<Insumo>) => {
        try {
            const res = await fetch(`${API_URL}/api/compras/insumos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create insumo");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const deleteInsumo = async (id: string) => {
        try {
            const res = await fetch(`${API_URL}/api/compras/insumos/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete insumo");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const createProducto = async (data: Partial<ProductoFabricado>) => {
        try {
            const res = await fetch(`${API_URL}/api/compras/productos_fabricados`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create producto");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const updateProducto = async (id: string, updates: Partial<ProductoFabricado>) => {
        try {
            const res = await fetch(`${API_URL}/api/compras/productos_fabricados/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error("Failed to update producto");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const deleteProducto = async (id: string) => {
        try {
            const res = await fetch(`${API_URL}/api/compras/productos_fabricados/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete producto");
            await fetchData(true);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    return { terceros, insumos, ordenes, productos, isLoading, error, createTercero, updateTercero, deleteTercero, createInsumo, deleteInsumo, createOrden, updateOrden, deleteOrden, createProducto, updateProducto, deleteProducto, fetchData };
}
