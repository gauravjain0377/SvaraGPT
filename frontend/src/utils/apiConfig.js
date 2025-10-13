const rawBaseUrl = import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim();
const fallbackBaseUrl = "http://localhost:8080";

const normalizedBaseUrl = (rawBaseUrl && rawBaseUrl.length > 0 ? rawBaseUrl : fallbackBaseUrl).replace(/\/+$/, "");

export const API_BASE_URL = normalizedBaseUrl;

export const apiUrl = (path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};