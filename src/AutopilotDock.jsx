import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, AUTH_EVENT, getToken } from "./api.js";

const DEFAULT_STANDARDS = [
  "ISO 45001",
  "ISO 14001",
  "ISO 50001",
  "ISO 9001",
  "ISO/IEC 27001",
  "EN 50600",
];

const DEFAULT_ARTIFACTS = [
  "risk_assessment",
  "operating_instruction",
  "training_plan",
  "ims_requirements_map",
];

const panelStyle = {
  position: "fixed",
  right: 18,
  bottom: 18,
  zIndex: 1100,
  width: "min(460px, calc(100vw - 36px))",
  maxHeight: "calc(100vh - 90px)",
  overflow: "auto",
  padding: 18,
  borderRadius: 16,
  background: "#0f172a",
  color: "#f8fafc",
  boxShadow: "0 24px 60px rgba(2, 6, 23, 0.42)",
  border: "1px solid rgba(148, 163, 184, 0.22)",
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

const buttonStyle = {
  border: 0,
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

export default function AutopilotDock() {
  const { t } = useTranslation();
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()));
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const syncAuthentication = () => {
      const next = Boolean(getToken());
      setAuthenticated(next);
      if (!next) {
        setOpen(false);
        setResult(null);
      }
    };

    window.addEventListener(AUTH_EVENT, syncAuthentication);
    window.addEventListener("storage", syncAuthentication);
    return () => {
      window.removeEventListener(AUTH_EVENT, syncAuthentication);
      window.removeEventListener("storage", syncAuthentication);
    };
  }, []);

  const artifactLabels = useMemo(
    () => ({
      risk_assessment: "Gefährdungsbeurteilung / Risk Assessment",
      operating_instruction: "Betriebsanweisung / Operating Instruction",
      training_plan: "Schulungsplan / Training Plan",
      ims_requirements_map: "IMS Requirements Map",
    }),
    [],
  );

  async function runAutopilot(event) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setBusy(true);
    setError("");
    setResult(null);
    try {
      const activity = await api.createIMSActivity({
        title: title.trim(),
        description: description.trim(),
        industry: industry.trim() || null,
        location: location.trim() || null,
      });

      const generated = await api.generateIMSArtifacts(activity.id, {
        standards: DEFAULT_STANDARDS,
        artifact_types: DEFAULT_ARTIFACTS,
      });
      setResult(generated);
    } catch (requestError) {
      setError(requestError.message || "Safety360 Autopilot konnte den Vorgang nicht verarbeiten.");
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
          right: 18,
          bottom: 18,
          zIndex: 1100,
          background: "#38bdf8",
          color: "#082f49",
          boxShadow: "0 16px 36px rgba(2, 132, 199, 0.32)",
        }}
        aria-label={t("autopilot")}
      >
        S360 · {t("autopilot")}
      </button>
    );
  }

  return (
    <aside style={panelStyle} aria-label={t("autopilotTitle")}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>
            SAFETY360
          </div>
          <h2 style={{ margin: "4px 0 8px" }}>{t("autopilotTitle")}</h2>
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
        {t("autopilotDescription")}
      </p>

      <form onSubmit={runAutopilot}>
        <label>
          {t("activityTitle")}
          <input
            style={fieldStyle}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={250}
          />
        </label>
        <label>
          {t("activityDescription")}
          <textarea
            style={{ ...fieldStyle, minHeight: 110, resize: "vertical" }}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            maxLength={30000}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            {t("industry")}
            <input
              style={fieldStyle}
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              maxLength={120}
            />
          </label>
          <label>
            {t("location")}
            <input
              style={fieldStyle}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={250}
            />
          </label>
        </div>

        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
          {DEFAULT_STANDARDS.join(" · ")}
        </div>

        {error && (
          <div style={{ padding: 10, borderRadius: 8, background: "#7f1d1d", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            ...buttonStyle,
            width: "100%",
            background: busy ? "#64748b" : "#38bdf8",
            color: "#082f49",
          }}
        >
          {busy ? t("generating") : t("generate")}
        </button>
      </form>

      {result && (
        <section style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 8 }}>{t("generatedArtifacts")}</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {result.artifacts?.map((artifact) => (
              <article
                key={artifact.id}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: "#111827",
                  border: "1px solid #334155",
                }}
              >
                <strong>{artifactLabels[artifact.artifact_type] || artifact.artifact_type}</strong>
                <div style={{ marginTop: 4, fontSize: 12, color: "#94a3b8" }}>
                  {artifact.status} · v{artifact.version}
                </div>
              </article>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.5 }}>
            {t("reviewRequired")}
          </p>
        </section>
      )}
    </aside>
  );
}
