const rawBaseUrl = import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim();
const fallbackBaseUrl = "http://localhost:8080";

const normalizedBaseUrl = (rawBaseUrl && rawBaseUrl.length > 0 ? rawBaseUrl : fallbackBaseUrl).replace(/\/+$/, "");

export const API_BASE_URL = normalizedBaseUrl;

// Log API base URL in development (helps with debugging)
if (import.meta.env.DEV) {
  console.log("🔗 API Base URL:", API_BASE_URL);
}

export const apiUrl = (path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = `${API_BASE_URL}${normalizedPath}`;
  return fullUrl;
};