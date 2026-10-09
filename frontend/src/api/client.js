import { API_BASE_URL } from "../config.js";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let csrfToken = null;

/** Fetches (or reuses) the CSRF token. The backend sets the matching cookie on the same call. */
export async function getCsrfToken({ refresh = false } = {}) {
  if (!csrfToken || refresh) {
    const response = await fetch(`${API_BASE_URL}/auth/csrf`, { credentials: "include" });
    if (!response.ok) {
      throw new ApiError(response.status, "Could not start a secure session. Check that the DocSize server is running.");
    }
    csrfToken = (await response.json()).csrf_token;
  }
  return csrfToken;
}

/** Turns FastAPI's `detail` (a string, or a list of validation errors) into one readable sentence. */
export function describeError(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && item.msg ? item.msg.replace(/^Value error, /, "") : null))
      .filter(Boolean);
    return messages.length ? messages.join(" ") : "Please check the values you entered.";
  }
  return "Something went wrong. Please try again.";
}

/**
 * Calls the backend. JSON bodies are sent as JSON. Form bodies are sent as multipart.
 * Mutating requests (anything but GET) include the CSRF header.
 */
export async function request(path, { method = "GET", json, form, raw = false } = {}) {
  const headers = {};
  let body;

  if (method !== "GET") {
    headers["X-CSRF-Token"] = await getCsrfToken();
  }
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  if (form) {
    body = form; // the browser sets the multipart boundary itself
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body, credentials: "include" });
  } catch {
    throw new ApiError(0, "Cannot reach the DocSize server. Check your connection and try again.");
  }

  if (!response.ok) {
    let message = `The request failed (error ${response.status}).`;
    try {
      const data = await response.json();
      message = describeError(data.detail);
    } catch {
      // The body was not JSON. Keep the generic message.
    }
    if (response.status === 403 && method !== "GET") {
      csrfToken = null; // the token may be stale, so fetch a new one next time
    }
    throw new ApiError(response.status, message);
  }

  if (raw) return response;
  if (response.status === 204) return null;
  return response.json();
}
