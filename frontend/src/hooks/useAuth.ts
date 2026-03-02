"use client";
import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { API_URL } from "@/lib/config";

export type UserRole = "admin" | "viewer" | "asesora" | "wholesaler" | null;

interface AuthState {
    user: User | null;
    role: UserRole;
    isLoading: boolean;
    token: string | null;
}

// ─── Singleton cache compartida entre todos los componentes ───────────────────
let cachedToken: string | null = null;
let cachedRole: UserRole = null;
let tokenExpiry: number = 0;

/**
 * Devuelve el token Firebase del usuario actual.
 * Útil para llamadas directas al backend desde fuera del hook.
 */
export async function getAuthToken(): Promise<string | null> {
    const u = auth.currentUser;
    if (!u) return null;
    try {
        const tok = await u.getIdToken(false); // false = no forzar refresh
        return tok;
    } catch {
        return null;
    }
}

/**
 * Hook principal de autenticación.
 * - Escucha onAuthStateChanged de Firebase.
 * - Valida el rol llamando al backend (/auth/me) con el token Firebase real.
 * - Persiste el rol en localStorage solo como caché de UI (informativo).
 */
export function useAuth(): AuthState {
    const [state, setState] = useState<AuthState>({
        user: null,
        role: null,
        isLoading: true,
        token: null,
    });

    const fetchRole = useCallback(async (user: User) => {
        try {
            const now = Date.now();
            // Reusar caché si el token tiene menos de 50 min
            if (cachedToken && cachedRole && tokenExpiry > now) {
                setState({ user, role: cachedRole, isLoading: false, token: cachedToken });
                return;
            }

            const tok = await user.getIdToken(true);
            cachedToken = tok;
            tokenExpiry = now + 50 * 60 * 1000; // 50 minutos

            const res = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${tok}` },
            });

            if (res.ok) {
                const data = await res.json();
                const role = (data.role as UserRole) || "viewer";
                cachedRole = role;
                // Solo como caché informativo de UI, NO es fuente de verdad
                localStorage.setItem("gco_role", role);
                setState({ user, role, isLoading: false, token: tok });
            } else {
                // Backend rechazó el token → sin acceso
                setState({ user, role: null, isLoading: false, token: null });
            }
        } catch {
            // Si no hay red, degradar a localStorage como último recurso
            const fallbackRole = (localStorage.getItem("gco_role") as UserRole) || "viewer";
            const tok = await user.getIdToken(false).catch(() => null);
            setState({ user, role: fallbackRole, isLoading: false, token: tok });
        }
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                fetchRole(firebaseUser);
            } else {
                cachedToken = null;
                cachedRole = null;
                tokenExpiry = 0;
                localStorage.removeItem("gco_role");
                setState({ user: null, role: null, isLoading: false, token: null });
            }
        });
        return () => unsub();
    }, [fetchRole]);

    return state;
}
