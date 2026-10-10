/**
 * One function per backend route the frontend uses. The route list is in frontend/README.md.
 */
import { request } from "./client.js";

export const api = {
  me: () => request("/auth/me"),
  authOptions: () => request("/auth/options"),
  requestOtp: (identifier, purpose) =>
    request("/auth/request-otp", { method: "POST", json: { identifier, purpose } }),
  verifyOtp: (identifier, code, purpose, consent) =>
    request("/auth/verify-otp", { method: "POST", json: { identifier, code, purpose, consent } }),
  googleSignIn: (credential, purpose, consent) =>
    request("/auth/google", { method: "POST", json: { credential, purpose, consent } }),
  logout: () => request("/auth/logout", { method: "POST" }),
  deleteAccount: () => request("/auth/account", { method: "DELETE" }),

  profiles: (documentType) =>
    request(`/profiles${documentType ? `?document_type=${encodeURIComponent(documentType)}` : ""}`),

  listDocuments: () => request("/documents"),
  uploadDocument: (file, documentType) => {
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", documentType);
    return request("/documents", { method: "POST", form });
  },
  deleteDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),
  originalFileBlob: (id) => request(`/documents/${id}/file`, { raw: true }).then((r) => r.blob()),

  processDocument: (id, body) => request(`/documents/${id}/process`, { method: "POST", json: body }),

  listDerived: () => request("/derived"),
  derivedFileBlob: (id) => request(`/derived/${id}/file`, { raw: true }).then((r) => r.blob()),
  deleteDerived: (id) => request(`/derived/${id}`, { method: "DELETE" }),
};
