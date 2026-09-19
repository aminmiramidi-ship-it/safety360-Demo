import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  api,
  AUTH_EVENT,
  getToken,
  setToken,
  ssoLoginUrl,
} from "./api.js";

const buttonStyle = {
  border: 0,
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 6,
  marginBottom: 12,
  borderRadius: 8,
  border: "1px solid #475569",
  background: "#111827",
  color: "#f8fafc",
  padding: "10px 12px",
};

const panelStyle = {
  position: "fixed",
  left: 18,
  bottom: 18,
  zIndex: 1090,
  width: "min(560px, calc(100vw - 36px))",
  maxHeight: "calc(100vh - 90px)",
  overflow: "auto",
  padding: 18,
  borderRadius: 16,
  background: "#0f172a",
  color: "#f8fafc",
  boxShadow: "0 24px 60px rgba(2, 6, 23, 0.42)",
  border: "1px solid rgba(148, 163, 184, 0.22)",
};

const cardStyle = {
  padding: 12,
  borderRadius: 12,
  background: "#111827",
  border: "1px solid #334155",
};

const supportedFormats = "PDF · DOCX · XLSX · PPTX · TXT · MD · CSV · JSON";

function normalizeFiles(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.files)) return payload.files;
  return [];
}

function isOfficeConvertible(file) {
  const name = String(file?.original_name || "").toLowerCase();
  return name.endsWith(".docx") || name.endsWith(".xlsx") || name.endsWith(".pptx");
}

export default function EnterpriseGatewayDock() {
  const { t } = useTranslation();
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()));
  const [open, setOpen] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [files, setFiles] = useState([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState("existing-document");
  const [folder, setFolder] = useState("/imports");
  const [processing, setProcessing] = useState({});
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const syncAuthentication = () => setAuthenticated(Boolean(getToken()));
    window.addEventListener(AUTH_EVENT, syncAuthentication);
    window.addEventListener("storage", syncAuthentication);
    return () => {
      window.removeEventListener(AUTH_EVENT, syncAuthentication);
      window.removeEventListener("storage", syncAuthentication);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoCode = params.get("sso_code");
    if (!ssoCode || getToken()) return;

    let cancelled = false;
    async function finishSso() {
      setBusy(true);
      setError("");
      try {
        const result = await api.exchangeSsoCode(ssoCode);
        if (cancelled) return;
        setToken(result.access_token);
        params.delete("sso_code");
        const cleanQuery = params.toString();
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`,
        );
        setMessage(
          t("ssoSuccess", {
            defaultValue: "Unternehmensanmeldung erfolgreich.",
          }),
        );
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message ||
              t("ssoExchangeError", {
                defaultValue: "SSO-Anmeldung konnte nicht abgeschlossen werden.",
              }),
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    finishSso();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!open || !authenticated) return;
    loadFiles();
  }, [open, authenticated, includeArchived]);

  const fileCountLabel = useMemo(
    () =>
      t("fileCount", {
        count: files.length,
        defaultValue: `${files.length} Datei(en)`,
      }),
    [files.length, t],
  );

  async function loadFiles() {
    setError("");
    try {
      const result = await api.listFiles(includeArchived);
      setFiles(normalizeFiles(result));
    } catch (requestError) {
      setError(
        requestError.message ||
          t("fileLoadError", { defaultValue: "Dateien konnten nicht geladen werden." }),
      );
    }
  }

  async function beginSso(event) {
    event.preventDefault();
    const slug = tenantSlug.trim();
    if (!slug) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const metadata = await api.ssoMetadata(slug);
      if (!metadata.enabled) {
        throw new Error(
          t("ssoNotEnabled", {
            defaultValue: "Für dieses Unternehmen ist SSO noch nicht aktiviert.",
          }),
        );
      }
      window.location.assign(ssoLoginUrl(slug));
    } catch (requestError) {
      setError(requestError.message || "SSO konnte nicht gestartet werden.");
      setBusy(false);
    }
  }

  async function upload(event) {
    event.preventDefault();
    if (!selectedFile) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const stored = await api.uploadFile(selectedFile, category.trim() || "general", folder.trim() || "/");
      setMessage(
        t("uploadAccepted", {
          defaultValue: `Datei sicher angenommen: ${stored.original_name}`,
        }),
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadFiles();
    } catch (requestError) {
      setError(
        requestError.message ||
          t("uploadError", { defaultValue: "Datei konnte nicht sicher angenommen werden." }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function perform(fileId, action, successMessage) {
    setProcessing((current) => ({ ...current, [fileId]: action }));
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (successMessage) setMessage(successMessage(result));
      await loadFiles();
      return result;
    } catch (requestError) {
      setError(requestError.message || "Aktion konnte nicht ausgeführt werden.");
      return null;
    } finally {
      setProcessing((current) => {
        const next = { ...current };
        delete next[fileId];
        return next;
      });
    }
  }

  async function processFile(file) {
    const result = await perform(
      file.id,
      () => api.processFile(file.id),
      () =>
        t("processingDone", {
          defaultValue: "Datei wurde geprüft und verarbeitet.",
        }),
    );
    if (result?.preview) {
      setPreview({
        title: file.original_name,
        text: result.preview,
        sha256: result.extracted_sha256,
      });
    }
  }

  async function showContent(file) {
    setProcessing((current) => ({ ...current, [file.id]: "preview" }));
    setError("");
    try {
      const result = await api.fileContent(file.id);
      setPreview({
        title: file.original_name,
        text: result.text,
        sha256: result.sha256,
      });
    } catch (requestError) {
      setError(requestError.message || "Dateiinhalt ist noch nicht verfügbar.");
    } finally {
      setProcessing((current) => {
        const next = { ...current };
        delete next[file.id];
        return next;
      });
    }
  }

  async function promote(file) {
    await perform(
      file.id,
      () =>
        api.promoteFileToDocument(file.id, {
          title: file.original_name.replace(/\.[^.]+$/, ""),
          document_type: "imported_document",
        }),
      (result) =>
        t("promotedDocument", {
          defaultValue: `Revisionssicherer Dokumententwurf #${result.document_id} wurde erstellt.`,
        }),
    );
  }

  async function convert(file) {
    await perform(
      file.id,
      () => api.convertFileToPdf(file.id),
      (result) =>
        t("convertedPdf", {
          defaultValue: `PDF wurde als neue Datei gespeichert: ${result.converted_file.original_name}`,
        }),
    );
  }

  async function archive(file) {
    await perform(
      file.id,
      () => api.archiveFile(file.id),
      () => t("archived", { defaultValue: "Datei wurde archiviert." }),
    );
  }

  async function restore(file) {
    await perform(
      file.id,
      () => api.restoreFile(file.id),
      () => t("restored", { defaultValue: "Datei wurde wiederhergestellt." }),
    );
  }

  async function permanentlyDelete(file) {
    const confirmed = window.confirm(
      t("deleteConfirm", {
        defaultValue: "Archivierte Datei endgültig löschen? Dieser Schritt kann nicht rückgängig gemacht werden.",
      }),
    );
    if (!confirmed) return;
    await perform(
      file.id,
      () => api.deleteFile(file.id),
      () => t("deleted", { defaultValue: "Datei wurde endgültig gelöscht." }),
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          ...buttonStyle,
          position: "fixed",
          left: 18,
          bottom: 18,
          zIndex: 1090,
          background: "#22c55e",
          color: "#052e16",
          boxShadow: "0 16px 36px rgba(22, 163, 74, 0.28)",
        }}
        aria-label={t("enterpriseGateway", { defaultValue: "Enterprise Gateway" })}
      >
        S360 · {t("enterpriseGateway", { defaultValue: "Enterprise Gateway" })}
      </button>
    );
  }

  return (
    <aside style={panelStyle} aria-label={t("enterpriseGateway", { defaultValue: "Enterprise Gateway" })}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ color: "#22c55e", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>
            SAFETY360 ENTERPRISE
          </div>
          <h2 style={{ margin: "4px 0 8px" }}>
            {t("enterpriseGateway", { defaultValue: "Enterprise Gateway" })}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ ...buttonStyle, background: "#1e293b", color: "#f8fafc" }}
        >
          {t("close")}
        </button>
      </div>

      <p style={{ marginTop: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
        {t("enterpriseGatewayDescription", {
          defaultValue: "Sichere Unternehmensanmeldung sowie kontrollierte Annahme, Prüfung, Verarbeitung und Dokumentenlenkung vorhandener Kundendateien.",
        })}
      </p>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#7f1d1d", marginBottom: 12 }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ padding: 10, borderRadius: 8, background: "#14532d", marginBottom: 12 }}>
          {message}
        </div>
      )}

      {!authenticated ? (
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>
            {t("companySso", { defaultValue: "Unternehmens-SSO" })}
          </h3>
          <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>
            {t("companySsoDescription", {
              defaultValue: "Anmeldung über den freigegebenen Identity Provider Ihres Unternehmens, z. B. Microsoft Entra ID, Okta oder Keycloak über OpenID Connect.",
            })}
          </p>
          <form onSubmit={beginSso}>
            <label>
              {t("organizationId", { defaultValue: "Unternehmenskennung" })}
              <input
                style={fieldStyle}
                value={tenantSlug}
                onChange={(event) => setTenantSlug(event.target.value)}
                placeholder="beispiel-gmbh"
                autoCapitalize="none"
                autoCorrect="off"
                required
                maxLength={100}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              style={{ ...buttonStyle, width: "100%", background: "#22c55e", color: "#052e16" }}
            >
              {busy
                ? t("connecting", { defaultValue: "Verbindung wird geprüft …" })
                : t("continueWithSso", { defaultValue: "Mit Unternehmens-SSO anmelden" })}
            </button>
          </form>
        </section>
      ) : (
        <>
          <section style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>
              {t("secureUpload", { defaultValue: "Sicherer Dokumenten-Upload" })}
            </h3>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 12 }}>
              {supportedFormats}
            </div>
            <form onSubmit={upload}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.json"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                required
                style={{ ...fieldStyle, padding: 8 }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label>
                  {t("category", { defaultValue: "Kategorie" })}
                  <input
                    style={fieldStyle}
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    maxLength={80}
                  />
                </label>
                <label>
                  {t("folder", { defaultValue: "Ablagepfad" })}
                  <input
                    style={fieldStyle}
                    value={folder}
                    onChange={(event) => setFolder(event.target.value)}
                    maxLength={250}
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={busy || !selectedFile}
                style={{ ...buttonStyle, width: "100%", background: "#22c55e", color: "#052e16" }}
              >
                {busy
                  ? t("uploadChecking", { defaultValue: "Prüfen und sicher übernehmen …" })
                  : t("uploadSecurely", { defaultValue: "Datei sicher übernehmen" })}
              </button>
            </form>
            <p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>
              {t("uploadSecurityNotice", {
                defaultValue: "Dateien werden als nicht vertrauenswürdig behandelt, vor der Ablage geprüft und als unverändertes Original mit Integritätsnachweis gespeichert.",
              })}
            </p>
          </section>

          <section style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>{t("customerFiles", { defaultValue: "Kundendateien" })}</h3>
                <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>{fileCountLabel}</div>
              </div>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => setIncludeArchived(event.target.checked)}
                />
                {t("showArchived", { defaultValue: "Archiv anzeigen" })}
              </label>
            </div>

            <div style={{ display: "grid", gap: 9, marginTop: 10 }}>
              {files.map((file) => {
                const isArchived = Boolean(file.archived_at);
                const actionBusy = Boolean(processing[file.id]);
                return (
                  <article key={file.id} style={cardStyle}>
                    <strong style={{ overflowWrap: "anywhere" }}>{file.original_name}</strong>
                    <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>
                      {file.category} · {Math.max(1, Math.round(file.size_bytes / 1024))} KB · SHA-256 {String(file.sha256).slice(0, 12)}…
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                      {!isArchived && (
                        <>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => processFile(file)}
                            style={{ ...buttonStyle, background: "#0e7490", color: "#ecfeff", fontSize: 11 }}
                          >
                            {t("process", { defaultValue: "Verarbeiten" })}
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => showContent(file)}
                            style={{ ...buttonStyle, background: "#334155", color: "#f8fafc", fontSize: 11 }}
                          >
                            {t("preview", { defaultValue: "Inhalt" })}
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => promote(file)}
                            style={{ ...buttonStyle, background: "#1d4ed8", color: "#eff6ff", fontSize: 11 }}
                          >
                            {t("toControlledDocument", { defaultValue: "In Dokumentenlenkung" })}
                          </button>
                          {isOfficeConvertible(file) && (
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() => convert(file)}
                              style={{ ...buttonStyle, background: "#6d28d9", color: "#f5f3ff", fontSize: 11 }}
                            >
                              {t("convertPdf", { defaultValue: "PDF erzeugen" })}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => archive(file)}
                            style={{ ...buttonStyle, background: "#78350f", color: "#fffbeb", fontSize: 11 }}
                          >
                            {t("archive", { defaultValue: "Archivieren" })}
                          </button>
                        </>
                      )}
                      {isArchived && (
                        <>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => restore(file)}
                            style={{ ...buttonStyle, background: "#14532d", color: "#dcfce7", fontSize: 11 }}
                          >
                            {t("restore", { defaultValue: "Wiederherstellen" })}
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => permanentlyDelete(file)}
                            style={{ ...buttonStyle, background: "#7f1d1d", color: "#fee2e2", fontSize: 11 }}
                          >
                            {t("deletePermanently", { defaultValue: "Endgültig löschen" })}
                          </button>
                        </>
                      )}
                    </div>
                    {actionBusy && (
                      <div style={{ color: "#fbbf24", fontSize: 11, marginTop: 8 }}>
                        {t("processingAction", { defaultValue: "Sicherer Vorgang läuft …" })}
                      </div>
                    )}
                  </article>
                );
              })}
              {files.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: 13, padding: 12 }}>
                  {t("noFiles", { defaultValue: "Noch keine Dateien vorhanden." })}
                </div>
              )}
            </div>
          </section>

          {preview && (
            <section style={{ ...cardStyle, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                <div>
                  <strong>{preview.title}</strong>
                  {preview.sha256 && (
                    <div style={{ color: "#94a3b8", fontSize: 10, marginTop: 3, overflowWrap: "anywhere" }}>
                      Extracted SHA-256: {preview.sha256}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  style={{ ...buttonStyle, background: "#334155", color: "#f8fafc", padding: "6px 9px" }}
                >
                  {t("close")}
                </button>
              </div>
              <pre
                style={{
                  marginBottom: 0,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  maxHeight: 280,
                  overflow: "auto",
                  color: "#cbd5e1",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {preview.text}
              </pre>
            </section>
          )}
        </>
      )}
    </aside>
  );
}
