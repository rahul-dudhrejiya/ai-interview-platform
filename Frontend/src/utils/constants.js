import axios from "axios";

// Centralized application constants
export const ServerUrl = (
  import.meta.env.VITE_SERVER_URL || "http://localhost:8000"
).replace(/\/+$/, "");

// Global Axios Interceptor to automatically attach JWT token for cross-domain requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
