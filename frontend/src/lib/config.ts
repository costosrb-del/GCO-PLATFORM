export const API_URL = (() => {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

    // Client-side check (Bulletproof for deployments)
    if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:8000';
        }
        // Any other hostname (firebaseapp, vercel, etc) -> PROD Backend
        return 'https://gco-siigo-api-245366645678.us-central1.run.app';
    }

    // Server-side fallback (during build or SSR)
    if (process.env.NODE_ENV === 'development') return 'http://localhost:8000';
    return 'https://gco-siigo-api-245366645678.us-central1.run.app';
})();

console.log(`[Config] API_URL resolved to: ${API_URL}`);

export const getApiUrl = (path: string = "") => {
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith("/") ? path.substring(1) : path;
    return `${API_URL}/${cleanPath}`;
};
