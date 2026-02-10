
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

export const useMovements = (startDate: string, endDate: string, companies: string[] = [], refreshId: number = 0) => {
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

            // Use axios
            const { data } = await axios.get(`${getBaseUrl()}/movements/`, {
                headers: { Authorization: `Bearer ${token}` },
                params: params,
                timeout: 300000 // 5 minutes timeout for heavy historical sync
            });

            return data as MovementsResponse;
        },
        // Only run if dates are present
        // Optimizing for "Load Once per Day/Session"
        enabled: !!startDate && !!endDate,
        staleTime: Infinity,          // Never consider data 'stale' automatically
        gcTime: Infinity,             // Keep in memory indefinitely (v5 name for cacheTime)
        refetchOnWindowFocus: false,  // Do not refetch when switching tabs
        refetchOnMount: false,        // Do not refetch when component remounts
    });
};
