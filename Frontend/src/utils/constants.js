// Centralized application constants

export const ServerUrl = (
  import.meta.env.VITE_SERVER_URL || "http://localhost:8000"
).replace(/\/+$/, "");
