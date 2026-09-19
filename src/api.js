const browserHost = window.location.hostname || "127.0.0.1";
const browserProtocol = window.location.protocol === "https:" ? "https:" : "http:";
const DEFAULT_API_BASE_URL = `${browserProtocol}//${browserHost}:8000`;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
const AUTH_EVENT = "safety360-auth-changed";
const CSRF_COOKIE_NAME = "safety360_csrf";
const CSRF_HEADER_NAME = "X-Requested-With";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!cookie) return "";
  return decodeURIComponent(cookie.slice(prefix.length));
}

// Compatibility shim for the existing application shell.
// Safety360 no longer reads or persists a bearer token in browser storage.
// Returning a marker causes the app to verify the HttpOnly server session on startup.
export function getToken() {
  return "cookie-session";
}

// Compatibility shim for existing callers. A null value means explicit logout.
// Login responses no longer contain an access token and no secret is written to localStorage.
export function setToken(token) {
  if (token === null) {
    apiRequest("/auth/session/logout", { method: "POST" }).catch(() => undefined);
  }
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const method = String(options.method || "GET").toUpperCase();

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (UNSAFE_METHODS.has(method) && !headers.has(CSRF_HEADER_NAME)) {
    const csrfToken = getCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === "object" && body?.detail
        ? body.detail
        : typeof body === "string" && body
          ? body
          : `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export const api = {
  status: () => apiRequest("/status"),
  capabilities: () => apiRequest("/platform/capabilities"),
  register: (payload) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload) =>
    apiRequest("/auth/session/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => apiRequest("/auth/session/logout", { method: "POST" }),
  me: () => apiRequest("/auth/me"),
  currentTenant: () => apiRequest("/tenants/current"),
  createTenant: (payload) =>
    apiRequest("/tenants", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listInvitations: (includeClosed = false) =>
    apiRequest(`/tenants/invitations?include_closed=${String(includeClosed)}`),
  createInvitation: (payload) =>
    apiRequest("/tenants/invitations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  acceptInvitation: (invitationToken) =>
    apiRequest("/tenants/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ invitation_token: invitationToken }),
    }),
  listTickets: () => apiRequest("/tickets"),
  createTicket: (payload) =>
    apiRequest("/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listDocuments: ({ latestOnly = true, type = "", status = "" } = {}) => {
    const params = new URLSearchParams();
    params.set("latest_only", String(latestOnly));
    if (type) params.set("document_type", type);
    if (status) params.set("status", status);
    return apiRequest(`/documents?${params.toString()}`);
  },
  createDocument: (payload) =>
    apiRequest("/documents", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submitDocumentForReview: (documentId) =>
    apiRequest(`/documents/${documentId}/submit-review`, {
      method: "POST",
    }),
  approveDocument: (documentId) =>
    apiRequest(`/documents/${documentId}/approve`, {
      method: "POST",
    }),
  createDocumentRevision: (documentId, payload) =>
    apiRequest(`/documents/${documentId}/revisions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listIMSStandards: () => apiRequest("/ims/standards"),
  listIMSActivities: () => apiRequest("/ims/activities"),
  createIMSActivity: (payload) =>
    apiRequest("/ims/activities", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  generateIMSArtifacts: (activityId, payload) =>
    apiRequest(`/ims/activities/${activityId}/generate`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listIMSArtifacts: (activityId) => apiRequest(`/ims/activities/${activityId}/artifacts`),
  approveIMSArtifact: (artifactId) =>
    apiRequest(`/ims/artifacts/${artifactId}/approve`, {
      method: "POST",
    }),
  translationCapabilities: () => apiRequest("/translation/capabilities"),
  translate: (payload) =>
    apiRequest("/translation", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  agentCatalog: () => apiRequest("/agents/catalog"),
  createAgentPlan: (payload) =>
    apiRequest("/agents/plan", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submitAgentFeedback: (payload) =>
    apiRequest("/agents/feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  agentAdaptation: () => apiRequest("/agents/adaptation"),
  listContentPacks: () => apiRequest("/content-factory/packs"),
  getContentPack: (packId) => apiRequest(`/content-factory/packs/${packId}`),
  generateContentOutlines: (packId) =>
    apiRequest(`/content-factory/packs/${packId}/generate-outlines`, {
      method: "POST",
    }),
  listContentImpacts: (statusFilter = "") => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status_filter", statusFilter);
    const query = params.toString();
    return apiRequest(`/content-impact/impacts${query ? `?${query}` : ""}`);
  },
  scanContentImpacts: () =>
    apiRequest("/content-impact/impact-scan", {
      method: "POST",
    }),
  resolveContentImpact: (impactId, payload) =>
    apiRequest(`/content-impact/impacts/${impactId}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createContentRevisionFromImpact: (impactId, payload) =>
    apiRequest(`/content-impact/impacts/${impactId}/create-revision`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export { API_BASE_URL, AUTH_EVENT };
