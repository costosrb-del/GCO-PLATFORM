export const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "https://gco-siigo-api-245366645678.us-central1.run.app");

export const getApiUrl = (path: string = "") => {
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith("/") ? path.substring(1) : path;
    return `${API_URL}/${cleanPath}`;
};
