import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import { API_URL } from "@/lib/config";

const getBaseUrl = () => {
    return API_URL;
};

export const useInventory = () => {
    return useQuery({
        queryKey: ['inventory'],
        queryFn: async () => {
            const token = localStorage.getItem("gco_token");
            if (!token) throw new Error("No authenticated");

            const { data } = await axios.get(`${getBaseUrl()}/inventory?force_refresh=true`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return data.data; // The API returns { data: [...], count: N, errors: [] }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
    });
};

export const useSalesAverages = (enabled: boolean = false) => {
    return useQuery({
        queryKey: ['salesAverages'],
        queryFn: async () => {
            const token = localStorage.getItem("gco_token");
            if (!token) throw new Error("No authenticated");

            const { data } = await axios.get(`${getBaseUrl()}/inventory/analysis/sales-averages?days=16`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 300000
            });
            return data;
        },
        enabled: enabled, // Only run when triggered or enabled
        staleTime: 1000 * 60 * 60 * 24, // 24 hours (as per user requirement to match day)
    });
};

export const useRefreshSalesAverages = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const token = localStorage.getItem("gco_token");
            if (!token) throw new Error("No authenticated");

            // Request refresh and wait (timeout 5 minutes)
            await axios.get(`${getBaseUrl()}/inventory/analysis/sales-averages?days=16&force_refresh=true`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 300000
            });
        },
        onSuccess: () => {
            // Invalidate to re-fetch the fresh data from cache
            queryClient.invalidateQueries({ queryKey: ['salesAverages'] });
        }
    });
};
