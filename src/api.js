const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const TOKEN_KEY = "safety360.access_token";
const AUTH_EVENT = "safety360-auth-changed";

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
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
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
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
