/**
 * The one place where the backend address is configured.
 *
 * BACKEND_URL is the FastAPI server. In development, Vite forwards every request that starts
 * with API_BASE_URL to BACKEND_URL. The browser therefore talks only to the frontend origin,
 * so the SameSite session cookie is sent. Browsers treat localhost and 127.0.0.1 as different
 * sites, so calling the backend directly would silently drop the cookie.
 *
 * For a deployed build, set VITE_API_BASE_URL to the full API origin (for example
 * https://api.example.com). CORS on the backend must then allow the frontend origin.
 */
export const BACKEND_URL = "http://127.0.0.1:8000";

// import.meta.env is undefined when vite.config.js loads this file under Node, hence the guard.
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "/api";

export const MAX_UPLOAD_MB = 10;

/** OAuth client ID for Google sign-in. Empty means the Google button shows a setup message. */
export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || "";
