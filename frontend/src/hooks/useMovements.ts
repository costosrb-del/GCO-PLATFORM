
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { API_URL } from "@/lib/config";

const getBaseUrl = () => {
    return API_URL;
};

export interface Movement {
    date: string;
    doc_type: string;
    doc_number: string;
    provider_doc?: string;
    client: string;
    nit: string;
    code: string;
    name: string;
    warehouse: string;
    quantity: number;
    price: number;
    total: number;
    type: string;
    observations: string;
    company?: string;

    // Audit Fields (Optional)
    cost_center?: string;
    seller?: string;
    payment_forms?: string;
    taxes?: string;
    currency?: string;
    exchange_rate?: number;
    created_at?: string;
    created_by?: string;
    doc_total_value?: number;
}

interface MovementsResponse {
    count: number;
    data: Movement[];
    errors?: string[];
}

export const useMovements = (
    startDate: string,
    endDate: string,
    companies: string[] = [],
    refreshId: number = 0,
    onProgress?: (step: string, progress: number) => void
) => {
    return useQuery({
        queryKey: ['movements', startDate, endDate, companies, refreshId],
        queryFn: async () => {
            // Validate dates
            if (!startDate || !endDate) return { count: 0, data: [] };

            const token = localStorage.getItem("gco_token");
            if (!token) throw new Error("No authenticated");

            const params = new URLSearchParams();
            params.append('start_date', startDate);
            params.append('end_date', endDate);
            companies.forEach(c => params.append('companies', c));

            if (refreshId > 0) {
                params.append('force_refresh', 'true');
            }

            return new Promise<MovementsResponse>((resolve, reject) => {
                const eventSource = new EventSource(
                    `${getBaseUrl()}/movements/stream?token=${token}&${params.toString()}`
                );

                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        if (data.error) {
                            eventSource.close();
                            reject(new Error(data.error));
                            return;
                        }

                        if (onProgress && data.step) {
                            onProgress(data.step, data.progress);
                        }

                        if (data.result !== undefined) {
                            eventSource.close();
                            resolve(data.result as MovementsResponse);
                        }
                    } catch (err) {
                        eventSource.close();
                        reject(err);
                    }
                };

                eventSource.onerror = (err) => {
                    eventSource.close();
                    reject(new Error("Error en la conexión con el servidor (SSE)."));
                };
            });
        },
        enabled: !!startDate && !!endDate,
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });
};
