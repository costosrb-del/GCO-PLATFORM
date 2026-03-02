'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const FIVE_MINUTES = 5 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // Datos considerados frescos por 5 minutos → 0 peticiones redundantes
                staleTime: FIVE_MINUTES,
                // Mantener en caché RAM del browser 15 min después de dejar de usarse
                gcTime: FIFTEEN_MINUTES,
                // No refrescar al volver a la pestaña (ya tenemos caché backend)
                refetchOnWindowFocus: false,
                // No refrescar al reconectar si los datos son frescos
                refetchOnReconnect: 'always',
                // Reintentar 1 vez con backoff de 2s
                retry: 1,
                retryDelay: 2000,
                // Mostrar datos del caché inmediatamente mientras revalida en background
                placeholderData: (prev: any) => prev,
            },
            mutations: {
                // No reintentar mutaciones (pueden duplicar datos)
                retry: 0,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
