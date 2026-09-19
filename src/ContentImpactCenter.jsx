import { useEffect, useMemo, useState } from "react";

import { api } from "./api.js";

const READ_ROLES = new Set([
  "viewer",
  "manager",
  "hse_manager",
  "occupational_physician",
  "document_controller",
  "tenant_admin",
  "admin",
]);
const SCAN_ROLES = new Set(["hse_manager", "document_controller", "tenant_admin", "admin"]);
const CREATE_ROLES = new Set(["manager", "hse_manager", "document_controller", "tenant_admin", "admin"]);
const APPROVE_ROLES = new Set(["hse_manager", "document_controller", "tenant_admin", "admin"]);

function formatDate(value) {
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

function priorityLabel(priority) {
  const labels = {
    low: "Niedrig",
    normal: "Normal",
    high: "Hoch",
    critical: "Kritisch",
  };
  return labels[priority] || priority || "Normal";
}

function sourceTypeLabel(value) {
  const labels = {
    regulatory_requirement: "Rechts-/Regelwerksanforderung",
    industry_activity_template: "Tätigkeit / Prozess",
    industry_classification: "Branchenklassifikation",
    compliance_subject: "Compliance-Objekt",
    manual_reference: "Manuelle Referenz",
  };
  return labels[value] || value || "Quelle";
}

export default function ContentImpactCenter({ user, tenant }) {
  const [packs, setPacks] = useState([]);
  const [impacts, setImpacts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const role = user?.role || "user";
  const canRead = READ_ROLES.has(role);
  const canScan = SCAN_ROLES.has(role);
  const canCreate = CREATE_ROLES.has(role);
  const canApprove = APPROVE_ROLES.has(role);

  const metrics = useMemo(() => {
    const pending = impacts.filter((item) => item.status === "pending");
    return {
      packs: packs.length,
      reviewRequired: packs.filter((item) => item.currentness_status === "review_required").length,
      pending: pending.length,
      critical: pending.filter((item) => item.priority === "critical").length,
      high: pending.filter((item) => item.priority === "high").length,
    };
  }, [packs, impacts]);

  async function refresh() {
    if (!tenant || !canRead) return;
    setError("");
    const [packResult, impactResult] = await Promise.allSettled([
      api.listContentPacks(),
      api.listContentImpacts(),
    ]);

    if (packResult.status === "fulfilled") {
      setPacks(packResult.value.packs || []);
    } else {
      setError(packResult.reason?.message || "Content Packs konnten nicht geladen werden.");
    }

    if (impactResult.status === "fulfilled") {
      setImpacts(impactResult.value.impacts || []);
    } else {
      setError(impactResult.reason?.message || "Änderungsauswirkungen konnten nicht geladen werden.");
    }
  }

  useEffect(() => {
    refresh();
  }, [tenant?.id, role]);

  async function runScan() {
    if (!canScan) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.scanContentImpacts();
      setNotice(
        `Impact-Scan abgeschlossen: ${result.checked ?? 0} Abhängigkeiten geprüft, ${result.detected ?? 0} Änderungen erkannt.`,
      );
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "Impact-Scan konnte nicht ausgeführt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function createRevision(impact) {
    if (!canCreate) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.createContentRevisionFromImpact(impact.id, {
        change_reason: `Änderungsprüfung aufgrund ${sourceTypeLabel(impact.trigger_type)}: ${impact.trigger_ref}`,
      });
      setNotice(
        `Kontrollierte Revision wurde als Entwurf angelegt${result?.pack?.version ? ` (Version ${result.pack.version})` : ""}.`,
      );
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "Revision konnte nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveImpact(impact, resolution) {
    if (!canApprove) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.resolveContentImpact(impact.id, {
        resolution,
        note:
          resolution === "accepted_no_change"
            ? "Fachlich geprüft: Änderung erfordert für diesen Content Pack keine Revision."
            : "Fachlich geprüft und als nicht anwendbar bzw. nicht relevant verworfen.",
      });
      setNotice("Impact wurde nachvollziehbar geprüft und im Audit-Trail abgeschlossen.");
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "Impact konnte nicht abgeschlossen werden.");
    } finally {
      setBusy(false);
    }
  }

  if (!tenant || !canRead) return null;

  const pendingImpacts = impacts.filter((item) => item.status === "pending");

  return (
    <section id="impact-center" className="panel impact-center">
      <div className="section-heading impact-heading">
        <div>
          <p className="eyebrow">Regulatory & Content Intelligence</p>
          <h2>Änderungs- & Impact Center</h2>
          <p className="impact-intro">
            Safety360 überwacht verknüpfte Rechts-, Branchen-, Tätigkeits- und Compliance-Grundlagen.
            Erkannte Änderungen führen kontrolliert in die Revision – niemals in ein stilles Überschreiben freigegebener Inhalte.
          </p>
        </div>
        <div className="impact-actions">
          <button className="secondary" type="button" onClick={refresh} disabled={busy}>
            Aktualisieren
          </button>
          {canScan && (
            <button className="primary" type="button" onClick={runScan} disabled={busy}>
              {busy ? "Prüfung läuft …" : "Impact-Scan starten"}
            </button>
          )}
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="impact-metrics">
        <article>
          <span>Content Packs</span>
          <strong>{metrics.packs}</strong>
        </article>
        <article>
          <span>Review erforderlich</span>
          <strong>{metrics.reviewRequired}</strong>
        </article>
        <article>
          <span>Offene Impacts</span>
          <strong>{metrics.pending}</strong>
        </article>
        <article>
          <span>Hoch / kritisch</span>
          <strong>{metrics.high + metrics.critical}</strong>
        </article>
      </div>

      {pendingImpacts.length === 0 ? (
        <div className="impact-empty">
          <strong>Keine offenen Änderungsauswirkungen.</strong>
          <span>Verknüpfte Inhalte sind aus Sicht der aktuell erfassten Abhängigkeiten ohne offenen Review-Trigger.</span>
        </div>
      ) : (
        <div className="impact-list">
          {pendingImpacts.map((impact) => (
            <article className={`impact-card priority-${impact.priority || "normal"}`} key={impact.id}>
              <div className="impact-card-main">
                <div className="impact-card-title">
                  <span className={`impact-priority ${impact.priority || "normal"}`}>
                    {priorityLabel(impact.priority)}
                  </span>
                  <strong>{sourceTypeLabel(impact.trigger_type)}</strong>
                </div>
                <h3>{impact.trigger_ref}</h3>
                <p>{impact.rationale}</p>
                <dl className="impact-details">
                  <div>
                    <dt>Content Pack</dt>
                    <dd>#{impact.content_pack_id}</dd>
                  </div>
                  <div>
                    <dt>Vorherige Version</dt>
                    <dd>{impact.previous_version || "–"}</dd>
                  </div>
                  <div>
                    <dt>Neue Version</dt>
                    <dd>{impact.current_version || "–"}</dd>
                  </div>
                  <div>
                    <dt>Erkannt</dt>
                    <dd>{formatDate(impact.detected_at)}</dd>
                  </div>
                </dl>
                {impact.evidence?.source_ref && (
                  <p className="impact-source">Quelle/Referenz: {impact.evidence.source_ref}</p>
                )}
              </div>

              <div className="impact-card-actions">
                {canCreate && (
                  <button className="primary" type="button" disabled={busy} onClick={() => createRevision(impact)}>
                    Kontrollierte Revision anlegen
                  </button>
                )}
                {canApprove && (
                  <>
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => resolveImpact(impact, "accepted_no_change")}
                    >
                      Geprüft – keine Revision nötig
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => resolveImpact(impact, "dismissed")}
                    >
                      Nicht anwendbar
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
