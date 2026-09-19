import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, AUTH_EVENT, getToken } from "./api.js";

const shellStyle = {
  position: "fixed",
  top: 72,
  right: 18,
  zIndex: 1085,
  width: "min(620px, calc(100vw - 36px))",
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

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 6,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #475569",
  background: "#111827",
  color: "#f8fafc",
  padding: "9px 11px",
};

const buttonStyle = {
  border: 0,
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 750,
  cursor: "pointer",
};

function stateStyle(value) {
  const styles = {
    current: { background: "#14532d", color: "#dcfce7" },
    review_required: { background: "#7c2d12", color: "#ffedd5" },
    superseded: { background: "#334155", color: "#e2e8f0" },
    pending: { background: "#713f12", color: "#fef3c7" },
    critical: { background: "#7f1d1d", color: "#fee2e2" },
    high: { background: "#7c2d12", color: "#ffedd5" },
    normal: { background: "#164e63", color: "#cffafe" },
    low: { background: "#334155", color: "#e2e8f0" },
  };
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 800,
    ...(styles[value] || styles.normal),
  };
}

function normalizePacks(payload) {
  return Array.isArray(payload?.packs) ? payload.packs : [];
}

function normalizeImpacts(payload) {
  return Array.isArray(payload?.impacts) ? payload.impacts : [];
}

export default function ContentGovernanceDock() {
  const { t } = useTranslation();
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [packs, setPacks] = useState([]);
  const [impacts, setImpacts] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState("");
  const [selectedPack, setSelectedPack] = useState(null);
  const [title, setTitle] = useState("");
  const [activityRef, setActivityRef] = useState("");
  const [targetAudience, setTargetAudience] = useState("employees");
  const [language, setLanguage] = useState("de");
  const [depthProfile, setDepthProfile] = useState("standard");
  const [changeReasons, setChangeReasons] = useState({});

  useEffect(() => {
    const syncAuthentication = () => {
      const next = Boolean(getToken());
      setAuthenticated(next);
      if (!next) {
        setOpen(false);
        setPacks([]);
        setImpacts([]);
        setSelectedPack(null);
      }
    };
    window.addEventListener(AUTH_EVENT, syncAuthentication);
    window.addEventListener("storage", syncAuthentication);
    return () => {
      window.removeEventListener(AUTH_EVENT, syncAuthentication);
      window.removeEventListener("storage", syncAuthentication);
    };
  }, []);

  useEffect(() => {
    if (!authenticated || !open) return;
    refresh().catch(() => undefined);
  }, [authenticated, open]);

  useEffect(() => {
    if (!selectedPackId || !authenticated) {
      setSelectedPack(null);
      return;
    }
    api.getContentPack(selectedPackId)
      .then(setSelectedPack)
      .catch((requestError) => setError(requestError.message || "Content Pack konnte nicht geladen werden."));
  }, [selectedPackId, authenticated]);

  const pendingCount = useMemo(
    () => impacts.filter((item) => item.status === "pending").length,
    [impacts],
  );

  const reviewCount = useMemo(
    () => packs.filter((item) => item.currentness_status === "review_required").length,
    [packs],
  );

  async function refresh() {
    setError("");
    const [packResult, impactResult] = await Promise.allSettled([
      api.listContentPacks(),
      api.listContentImpacts(),
    ]);

    if (packResult.status === "fulfilled") {
      const nextPacks = normalizePacks(packResult.value);
      setPacks(nextPacks);
      if (!selectedPackId && nextPacks.length) {
        setSelectedPackId(String(nextPacks[0].id));
      }
    } else if (packResult.reason?.status !== 403 && packResult.reason?.status !== 409) {
      setError(packResult.reason?.message || "Content Packs konnten nicht geladen werden.");
    }

    if (impactResult.status === "fulfilled") {
      setImpacts(normalizeImpacts(impactResult.value));
    } else if (impactResult.reason?.status !== 403 && impactResult.reason?.status !== 409) {
      setError(impactResult.reason?.message || "Content-Impacts konnten nicht geladen werden.");
    }
  }

  async function createPack(event) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await api.createContentPack({
        pack_key: `${title.trim().toLowerCase().replace(/[^a-z0-9äöüß]+/gi, "-").replace(/^-|-$/g, "") || "content"}-${Date.now()}`,
        title: title.trim(),
        activity_ref: activityRef.trim() || null,
        jurisdiction: "DE",
        target_audience: targetAudience,
        language,
        depth_profile: depthProfile,
        source_refs: [],
        requirement_refs: [],
      });
      setTitle("");
      setActivityRef("");
      setSelectedPackId(String(created.id));
      setMessage(
        t("contentPackCreated", {
          defaultValue: "Content Pack wurde als kontrollierter Entwurf angelegt. Quellen und fachliche Freigabe bleiben erforderlich.",
        }),
      );
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "Content Pack konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function generateOutlines(packId) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.generateContentOutlines(packId);
      setMessage(
        `${result.artifacts?.length || 0} ${t("draftArtifactsCreated", {
          defaultValue: "verknüpfte Entwürfe erzeugt – fachliche Prüfung erforderlich.",
        })}`,
      );
      setSelectedPack(await api.getContentPack(packId));
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "Entwürfe konnten nicht erzeugt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function scanImpacts() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.scanContentImpacts();
      setMessage(
        `${result.checked || 0} ${t("dependenciesChecked", { defaultValue: "Abhängigkeiten geprüft" })}, ` +
          `${result.detected || 0} ${t("changesDetected", { defaultValue: "Änderungen erkannt" })}.`,
      );
      await refresh();
      if (selectedPackId) setSelectedPack(await api.getContentPack(selectedPackId));
    } catch (requestError) {
      setError(requestError.message || "Impact Scan konnte nicht ausgeführt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function createRevision(impact) {
    const reason = String(changeReasons[impact.id] || "").trim();
    if (!reason) {
      setError("Bitte einen fachlichen Revisionsgrund eintragen.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.createContentRevisionFromImpact(impact.id, {
        change_reason: reason,
      });
      setMessage(
        `${t("revisionCreated", { defaultValue: "Neue kontrollierte Revision erstellt" })}: v${result.new_version}. ` +
          t("humanReviewRequired", { defaultValue: "Vor Freigabe ist eine qualifizierte Prüfung erforderlich." }),
      );
      setChangeReasons((current) => ({ ...current, [impact.id]: "" }));
      setSelectedPackId(String(result.new_pack_id));
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "Revision konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          ...buttonStyle,
          position: "fixed",
          top: 72,
          right: 18,
          zIndex: 1085,
          background: pendingCount || reviewCount ? "#9a3412" : "#0f172a",
          color: "#f8fafc",
          border: "1px solid #475569",
          boxShadow: "0 12px 28px rgba(2, 6, 23, 0.3)",
        }}
        aria-label={t("contentGovernance", { defaultValue: "Content Governance öffnen" })}
      >
        Content Governance{pendingCount ? ` · ${pendingCount}` : ""}
      </button>
    );
  }

  return (
    <section style={shellStyle} aria-label="Safety360 Content Governance">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
            Safety360 Content & Training Factory
          </p>
          <h2 style={{ margin: "4px 0 6px" }}>
            {t("contentGovernance", { defaultValue: "Content Governance & Aktualität" })}
          </h2>
          <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13 }}>
            {t("contentGovernanceIntro", {
              defaultValue:
                "Tätigkeitsbezogene HSE-Inhalte erzeugen, Quellenänderungen erkennen und Revisionen kontrolliert auslösen – ohne automatische Freigabe.",
            })}
          </p>
        </div>
        <button
          type="button"
          style={{ ...buttonStyle, background: "#334155", color: "#f8fafc" }}
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
        <div style={cardStyle}>
          <small style={{ color: "#94a3b8" }}>Content Packs</small>
          <strong style={{ display: "block", fontSize: 22 }}>{packs.length}</strong>
        </div>
        <div style={cardStyle}>
          <small style={{ color: "#94a3b8" }}>Review nötig</small>
          <strong style={{ display: "block", fontSize: 22 }}>{reviewCount}</strong>
        </div>
        <div style={cardStyle}>
          <small style={{ color: "#94a3b8" }}>Offene Impacts</small>
          <strong style={{ display: "block", fontSize: 22 }}>{pendingCount}</strong>
        </div>
      </div>

      {message && (
        <div style={{ ...cardStyle, marginTop: 12, borderColor: "#166534", background: "#052e16", color: "#dcfce7" }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ ...cardStyle, marginTop: 12, borderColor: "#991b1b", background: "#450a0a", color: "#fee2e2" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button
          type="button"
          disabled={busy}
          onClick={scanImpacts}
          style={{ ...buttonStyle, background: "#2563eb", color: "white" }}
        >
          {busy ? "…" : t("runImpactScan", { defaultValue: "Impact Scan starten" })}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => refresh()}
          style={{ ...buttonStyle, background: "#334155", color: "white" }}
        >
          {t("refresh", { defaultValue: "Aktualisieren" })}
        </button>
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>
          {t("newContentPack", { defaultValue: "Neues Content Pack anlegen" })}
        </summary>
        <form onSubmit={createPack} style={{ marginTop: 10 }}>
          <label>
            {t("title", { defaultValue: "Titel" })}
            <input style={fieldStyle} required value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            {t("activity", { defaultValue: "Tätigkeit / Prozess" })}
            <input
              style={fieldStyle}
              value={activityRef}
              onChange={(event) => setActivityRef(event.target.value)}
              placeholder="z. B. Arbeiten an elektrischen Anlagen"
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <label>
              Zielgruppe
              <select style={fieldStyle} value={targetAudience} onChange={(event) => setTargetAudience(event.target.value)}>
                <option value="employees">Mitarbeitende</option>
                <option value="managers">Führungskräfte</option>
                <option value="contractors">Auftragnehmer</option>
              </select>
            </label>
            <label>
              Sprache
              <input style={fieldStyle} value={language} onChange={(event) => setLanguage(event.target.value)} />
            </label>
            <label>
              Tiefe
              <select style={fieldStyle} value={depthProfile} onChange={(event) => setDepthProfile(event.target.value)}>
                <option value="short">Kurz</option>
                <option value="standard">Standard</option>
                <option value="deep">Vertieft</option>
              </select>
            </label>
          </div>
          <button disabled={busy} type="submit" style={{ ...buttonStyle, background: "#16a34a", color: "white" }}>
            {t("createDraft", { defaultValue: "Kontrollierten Entwurf anlegen" })}
          </button>
        </form>
      </details>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: "block", fontWeight: 800 }}>
          {t("contentPack", { defaultValue: "Content Pack" })}
          <select
            style={fieldStyle}
            value={selectedPackId}
            onChange={(event) => setSelectedPackId(event.target.value)}
          >
            <option value="">—</option>
            {packs.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.title} · v{pack.version} · {pack.currentness_status || "current"}
              </option>
            ))}
          </select>
        </label>

        {selectedPack?.pack && (
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <strong>{selectedPack.pack.title}</strong>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  v{selectedPack.pack.version} · {selectedPack.pack.jurisdiction} · {selectedPack.pack.language} · {selectedPack.pack.depth_profile}
                </div>
              </div>
              <span style={stateStyle(selectedPack.pack.currentness_status || "current")}>
                {selectedPack.pack.currentness_status || "current"}
              </span>
            </div>
            <div style={{ marginTop: 10, color: "#cbd5e1", fontSize: 13 }}>
              {selectedPack.pack.activity_ref || "Keine Tätigkeit hinterlegt"}
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>{selectedPack.artifacts?.length || 0} Artefakte</span>
              <button
                type="button"
                disabled={busy || selectedPack.pack.currentness_status === "superseded"}
                onClick={() => generateOutlines(selectedPack.pack.id)}
                style={{ ...buttonStyle, background: "#7c3aed", color: "white" }}
              >
                {t("generateLinkedDrafts", { defaultValue: "Verknüpfte Entwürfe erzeugen" })}
              </button>
            </div>
            <small style={{ display: "block", marginTop: 10, color: "#fbbf24" }}>
              {t("humanReviewGate", {
                defaultValue: "HSE-/Rechts-/Qualitätsinhalte werden nicht automatisch freigegeben. Qualifizierte Human Review bleibt Pflicht.",
              })}
            </small>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={{ marginBottom: 8 }}>
          {t("changeImpacts", { defaultValue: "Änderungs-Impacts" })}
        </h3>
        {impacts.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>
            {t("noImpacts", { defaultValue: "Keine erkannten Content-Impacts vorhanden." })}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 9 }}>
            {impacts.slice(0, 20).map((impact) => (
              <article key={impact.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <strong>{impact.trigger_type}</strong>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>{impact.trigger_ref}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={stateStyle(impact.priority)}>{impact.priority}</span>
                    <span style={stateStyle(impact.status)}>{impact.status}</span>
                  </div>
                </div>
                <p style={{ margin: "9px 0", fontSize: 13, color: "#cbd5e1" }}>{impact.rationale}</p>
                {impact.status === "pending" && (
                  <div>
                    <textarea
                      style={{ ...fieldStyle, minHeight: 64 }}
                      value={changeReasons[impact.id] || ""}
                      onChange={(event) =>
                        setChangeReasons((current) => ({ ...current, [impact.id]: event.target.value }))
                      }
                      placeholder={t("revisionReason", {
                        defaultValue: "Fachlichen Revisionsgrund dokumentieren …",
                      })}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => createRevision(impact)}
                      style={{ ...buttonStyle, background: "#ea580c", color: "white" }}
                    >
                      {t("createGovernedRevision", { defaultValue: "Kontrollierte Revision anlegen" })}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
