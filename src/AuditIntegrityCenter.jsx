import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "./api.js";
import "./audit-integrity-center.css";

const REFRESH_INTERVAL_MS = 60_000;

function formatTimestamp(value) {
  if (!value) return "–";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function shortHash(value) {
  if (!value) return "–";
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AuditIntegrityCenter() {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState([]);
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [objectTypeFilter, setObjectTypeFilter] = useState("");

  const loadAudit = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setBusy(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (actionFilter.trim()) params.set("action", actionFilter.trim());
      if (objectTypeFilter.trim()) params.set("object_type", objectTypeFilter.trim());

      const [eventResult, verificationResult] = await Promise.all([
        api.listAuditEvents(params),
        api.verifyAuditIntegrity(),
      ]);

      setEvents(eventResult.events || []);
      setVerification(verificationResult);
      setAvailable(true);
    } catch (requestError) {
      if ([401, 403, 409].includes(requestError?.status)) {
        setAvailable(false);
        setOpen(false);
        setEvents([]);
        setVerification(null);
        return;
      }
      setError(requestError?.message || "Audit-Daten konnten nicht geladen werden.");
    } finally {
      if (!silent) setBusy(false);
    }
  }, [actionFilter, objectTypeFilter]);

  useEffect(() => {
    loadAudit({ silent: true });
  }, [loadAudit]);

  useEffect(() => {
    if (!available) return undefined;
    const timer = window.setInterval(() => {
      loadAudit({ silent: true });
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [available, loadAudit]);

  const integrityState = useMemo(() => {
    if (!verification) return "unknown";
    return verification.valid ? "valid" : "invalid";
  }, [verification]);

  const eventSummary = useMemo(() => {
    const actions = new Set(events.map((event) => event.action).filter(Boolean));
    const actors = new Set(events.map((event) => event.actor_user_id).filter(Boolean));
    return {
      actions: actions.size,
      actors: actors.size,
    };
  }, [events]);

  async function exportAudit() {
    setBusy(true);
    setError("");
    try {
      const payload = await api.exportAuditEvents(5000);
      const tenantPart = payload.tenant_id ? `tenant-${payload.tenant_id}` : "global";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadJson(`safety360-audit-${tenantPart}-${timestamp}.json`, payload);
    } catch (requestError) {
      setError(requestError?.message || "Audit-Export konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  if (!available) return null;

  return (
    <div className="audit-integrity-center" data-state={integrityState}>
      {!open ? (
        <button
          className="audit-integrity-launcher"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Audit Integrity Center öffnen"
        >
          <span className="audit-integrity-dot" aria-hidden="true" />
          <span>Audit</span>
          <strong>{verification?.valid ? "OK" : "Prüfen"}</strong>
        </button>
      ) : (
        <section className="audit-integrity-panel" aria-label="Safety360 Audit Integrity Center">
          <header className="audit-integrity-header">
            <div>
              <p className="audit-integrity-eyebrow">Governance & Nachweisführung</p>
              <h2>Audit Integrity Center</h2>
              <p>
                Strukturierte, mandantenbezogene Ereignisse mit kryptografischer
                Integritätsprüfung.
              </p>
            </div>
            <button
              className="audit-integrity-close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Audit Integrity Center schließen"
            >
              ×
            </button>
          </header>

          <div className={`audit-integrity-status ${integrityState}`}>
            <div className="audit-integrity-status-icon" aria-hidden="true">
              {integrityState === "valid" ? "✓" : integrityState === "invalid" ? "!" : "?"}
            </div>
            <div>
              <span>Integritätsstatus</span>
              <strong>
                {integrityState === "valid"
                  ? "Kette erfolgreich verifiziert"
                  : integrityState === "invalid"
                    ? "Integritätsabweichung erkannt"
                    : "Noch nicht geprüft"}
              </strong>
              <small>
                {verification
                  ? `${verification.checked_events ?? 0} Ereignisse geprüft · Head ${shortHash(verification.head_hash)}`
                  : "Verifikation wird geladen."}
              </small>
            </div>
          </div>

          <div className="audit-integrity-metrics">
            <article>
              <span>Geladene Ereignisse</span>
              <strong>{events.length}</strong>
            </article>
            <article>
              <span>Aktionstypen</span>
              <strong>{eventSummary.actions}</strong>
            </article>
            <article>
              <span>Akteure</span>
              <strong>{eventSummary.actors}</strong>
            </article>
          </div>

          <div className="audit-integrity-toolbar">
            <label>
              Aktion
              <input
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                placeholder="z. B. ticket.created"
              />
            </label>
            <label>
              Objekttyp
              <input
                value={objectTypeFilter}
                onChange={(event) => setObjectTypeFilter(event.target.value)}
                placeholder="z. B. ticket"
              />
            </label>
            <button type="button" onClick={() => loadAudit()} disabled={busy}>
              {busy ? "Prüfe …" : "Aktualisieren"}
            </button>
            <button type="button" onClick={exportAudit} disabled={busy}>
              Audit-Export
            </button>
          </div>

          {error && <div className="audit-integrity-error">{error}</div>}

          <div className="audit-integrity-events" role="region" aria-label="Audit-Ereignisse">
            {events.length === 0 ? (
              <p className="audit-integrity-empty">Keine passenden Audit-Ereignisse vorhanden.</p>
            ) : (
              events.map((event) => (
                <article className="audit-integrity-event" key={event.event_id}>
                  <div className="audit-integrity-event-topline">
                    <strong>{event.action}</strong>
                    <span>{formatTimestamp(event.created_at)}</span>
                  </div>
                  <div className="audit-integrity-event-meta">
                    <span>{event.object_type}{event.object_id ? ` #${event.object_id}` : ""}</span>
                    <span>Akteur {event.actor_user_id ?? "System"}</span>
                    <span>{event.outcome}</span>
                    <span>Seq. {event.sequence}</span>
                  </div>
                  <div className="audit-integrity-hash">
                    <span>Hash</span>
                    <code title={event.record_hash}>{shortHash(event.record_hash)}</code>
                  </div>
                </article>
              ))
            )}
          </div>

          <footer className="audit-integrity-footer">
            <span>
              Der Status weist Manipulationen innerhalb der geprüften HMAC-Kette nach; er ersetzt
              keine externe WORM-/Archivzertifizierung.
            </span>
          </footer>
        </section>
      )}
    </div>
  );
}
