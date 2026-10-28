import axios from "axios";

export const TOKEN_STORAGE_KEY = "tc_ipam_token";
export const NOTIFICATION_POLL_MS = 15000;

export const STATUS_LABEL = {
  free: "Free",
  in_use: "In Use",
  dhcp: "DHCP",
  stale_dns: "Stale DNS",
  conflict: "Conflict",
  reserved: "Reserved",
};

export const STATUS_DOT = {
  free: "bg-emerald-500",
  in_use: "bg-blue-500",
  dhcp: "bg-zinc-400",
  stale_dns: "bg-yellow-500",
  conflict: "bg-red-500",
  reserved: "bg-zinc-900 dark:bg-zinc-100",
};

export function getBackendBaseURL() {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (typeof window !== "undefined" && window.location) {
    const currentHost = window.location.hostname;
    const currentPort = window.location.port;
    // If running in development server on port 3000
    if (currentPort === "3000") {
      if (envUrl) {
        try {
          const parsed = new URL(envUrl);
          if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
            const port = parsed.port || "8001";
            return `${window.location.protocol}//${currentHost}:${port}/api`;
          }
        } catch {
          // Ignore URL parse error and fall back
        }
      }
      return `${window.location.protocol}//${currentHost}:8001/api`;
    }

    // On standard HTTP (80), HTTPS (443), or behind reverse proxy (Nginx)
    if (!envUrl) {
      return "/api";
    }
  }
  return envUrl ? `${envUrl.replace(/\/$/, "")}/api` : "/api";
}

export const baseURL = getBackendBaseURL();

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  config.baseURL = getBackendBaseURL();
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatError(err) {
  if (err?.response?.data?.detail) {
    if (typeof err.response.data.detail === "string") return err.response.data.detail;
    if (Array.isArray(err.response.data.detail)) {
      return err.response.data.detail.map((d) => d.msg || d).join(", ");
    }
  }
  return err?.response?.data?.message || err?.message || "An unexpected error occurred";
}
