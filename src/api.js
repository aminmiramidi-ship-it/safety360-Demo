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

  if (response.status === 204) return null;

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

function fileFormData(file, category = "general", folder = "/") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  formData.append("folder", folder);
  return formData;
}

export function ssoLoginUrl(tenantSlug) {
  const slug = encodeURIComponent(String(tenantSlug || "").trim());
  return `${API_BASE_URL}/auth/sso/tenant/${slug}/login`;
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
  listFiles: (includeArchived = false) =>
    apiRequest(`/files?include_archived=${String(includeArchived)}`),
  uploadFile: (file, category = "general", folder = "/") =>
    apiRequest("/files", {
      method: "POST",
      body: fileFormData(file, category, folder),
    }),
  processFile: (fileId) =>
    apiRequest(`/files/${fileId}/process`, {
      method: "POST",
    }),
  fileContent: (fileId) => apiRequest(`/files/${fileId}/content`),
  promoteFileToDocument: (fileId, payload) =>
    apiRequest(`/files/${fileId}/to-document`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  convertFileToPdf: (fileId) =>
    apiRequest(`/files/${fileId}/convert/pdf`, {
      method: "POST",
    }),
  archiveFile: (fileId) =>
    apiRequest(`/files/${fileId}/archive`, {
      method: "POST",
    }),
  restoreFile: (fileId) =>
    apiRequest(`/files/${fileId}/restore`, {
      method: "POST",
    }),
  deleteFile: (fileId) =>
    apiRequest(`/files/${fileId}`, {
      method: "DELETE",
    }),
  ssoMetadata: (tenantSlug) =>
    apiRequest(`/auth/sso/tenant/${encodeURIComponent(tenantSlug)}`),
  exchangeSsoCode: (code) =>
    apiRequest("/auth/sso/exchange", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  ssoConfig: () => apiRequest("/auth/sso/config"),
  updateSsoConfig: (payload) =>
    apiRequest("/auth/sso/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  listContentPacks: () => apiRequest("/content-factory/packs"),
  createContentPack: (payload) =>
    apiRequest("/content-factory/packs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getContentPack: (packId) => apiRequest(`/content-factory/packs/${packId}`),
  generateContentOutlines: (packId) =>
    apiRequest(`/content-factory/packs/${packId}/generate-outlines`, {
      method: "POST",
    }),
  reviewContentArtifact: (artifactId, approved = true) =>
    apiRequest(`/content-factory/artifacts/${artifactId}/review`, {
      method: "POST",
      body: JSON.stringify({ approved }),
    }),
  listContentDependencies: (packId) =>
    apiRequest(`/content-impact/packs/${packId}/dependencies`),
  createContentDependency: (payload) =>
    apiRequest("/content-impact/dependencies", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  scanContentImpacts: () =>
    apiRequest("/content-impact/impact-scan", {
      method: "POST",
    }),
  listContentImpacts: (statusFilter = "") => {
    const suffix = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : "";
    return apiRequest(`/content-impact/impacts${suffix}`);
  },
  signalContentDependency: (dependencyId, payload) =>
    apiRequest(`/content-impact/dependencies/${dependencyId}/signal`, {
      method: "POST",
      body: JSON.stringify(payload),
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
