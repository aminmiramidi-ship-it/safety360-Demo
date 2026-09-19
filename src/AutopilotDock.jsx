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

const cardStyle = {
  padding: 12,
  borderRadius: 12,
  background: "#111827",
  border: "1px solid #334155",
};

function badgeStyle(kind) {
  const variants = {
    low: { background: "#164e63", color: "#cffafe" },
    medium: { background: "#713f12", color: "#fef3c7" },
    high: { background: "#7c2d12", color: "#ffedd5" },
    critical: { background: "#7f1d1d", color: "#fee2e2" },
    review: { background: "#4c1d95", color: "#ede9fe" },
    auto: { background: "#14532d", color: "#dcfce7" },
  };
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 800,
    ...variants[kind],
  };
}

export default function AutopilotDock() {
  const { t } = useTranslation();
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()));
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("agents");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [objective, setObjective] = useState("");
  const [context, setContext] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [adaptation, setAdaptation] = useState([]);
  const [agentPlan, setAgentPlan] = useState(null);
  const [feedbackBusy, setFeedbackBusy] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [imsResult, setImsResult] = useState(null);

  useEffect(() => {
    const syncAuthentication = () => {
      const next = Boolean(getToken());
      setAuthenticated(next);
      if (!next) {
        setOpen(false);
        setAgentPlan(null);
        setImsResult(null);
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
    if (!open || mode !== "agents" || !authenticated) return;
    loadAgentState();
  }, [open, mode, authenticated]);

  const artifactLabels = useMemo(
    () => ({
      risk_assessment: t("riskAssessment", { defaultValue: "Gefährdungsbeurteilung / Risk Assessment" }),
      operating_instruction: t("operatingInstruction", { defaultValue: "Betriebsanweisung / Operating Instruction" }),
      training_plan: t("trainingPlan", { defaultValue: "Schulungsplan / Training Plan" }),
      ims_requirements_map: t("imsRequirementsMap", { defaultValue: "IMS Requirements Map" }),
    }),
    [t],
  );

  async function loadAgentState() {
    setError("");
    try {
      const [catalogResponse, adaptationResponse] = await Promise.all([
        api.agentCatalog(),
        api.agentAdaptation(),
      ]);
      setCatalog(catalogResponse.agents || []);
      setAdaptation(adaptationResponse.agents || []);
    } catch (requestError) {
      setError(requestError.message || t("agentLoadError", { defaultValue: "Agentenstatus konnte nicht geladen werden." }));
    }
  }

  async function runAgentPlan(event) {
    event.preventDefault();
    if (!objective.trim()) return;

    setBusy(true);
    setError("");
    setAgentPlan(null);
    try {
      const result = await api.createAgentPlan({
        objective: objective.trim(),
        context: context.trim() || null,
        requested_agents: [],
      });
      setAgentPlan(result);
      await loadAgentState();
    } catch (requestError) {
      setError(requestError.message || t("agentPlanError", { defaultValue: "Agentenplan konnte nicht erstellt werden." }));
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback(task, outcome, rating) {
    if (!agentPlan?.run_id) return;
    const key = `${task.agent_id}:${outcome}`;
    setFeedbackBusy(key);
    setError("");
    try {
      await api.submitAgentFeedback({
        run_id: agentPlan.run_id,
        agent_id: task.agent_id,
        outcome,
        rating,
        workflow: "agent_control_center",
      });
      await loadAgentState();
    } catch (requestError) {
      setError(requestError.message || t("feedbackError", { defaultValue: "Feedback konnte nicht gespeichert werden." }));
    } finally {
      setFeedbackBusy("");
    }
  }

  async function runImsAutopilot(event) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setBusy(true);
    setError("");
    setImsResult(null);
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
      setImsResult(generated);
    } catch (requestError) {
      setError(requestError.message || t("imsRunError", { defaultValue: "IMS-Autopilot konnte den Vorgang nicht verarbeiten." }));
    } finally {
      setBusy(false);
    }
  }

  const adaptationMap = useMemo(
    () => Object.fromEntries(adaptation.map((item) => [item.agent_id, item])),
    [adaptation],
  );

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
    <aside style={panelStyle} aria-label={t("agentControlCenter", { defaultValue: "Safety360 Agent Control Center" })}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" }}>
            SAFETY360
          </div>
          <h2 style={{ margin: "4px 0 8px" }}>
            {t("agentControlCenter", { defaultValue: "Agent Control Center" })}
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
        {t("agentControlDescription", {
          defaultValue: "Koordiniert spezialisierte KI-Agenten, lernt aus Feedback und hält kritische Entscheidungen unter menschlicher Kontrolle.",
        })}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setMode("agents")}
          style={{
            ...buttonStyle,
            background: mode === "agents" ? "#38bdf8" : "#1e293b",
            color: mode === "agents" ? "#082f49" : "#f8fafc",
          }}
        >
          {t("agents", { defaultValue: "KI-Agenten" })}
        </button>
        <button
          type="button"
          onClick={() => setMode("ims")}
          style={{
            ...buttonStyle,
            background: mode === "ims" ? "#38bdf8" : "#1e293b",
            color: mode === "ims" ? "#082f49" : "#f8fafc",
          }}
        >
          {t("imsAutopilot", { defaultValue: "IMS-Autopilot" })}
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#7f1d1d", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {mode === "agents" && (
        <>
          <form onSubmit={runAgentPlan}>
            <label>
              {t("objective", { defaultValue: "Ziel / Aufgabe" })}
              <textarea
                style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }}
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                required
                maxLength={4000}
                placeholder={t("objectivePlaceholder", {
                  defaultValue: "z. B. Prüfe unseren Prozess für Wartungsarbeiten im Rechenzentrum und schließe HSE-, ISO-, Security- und Schulungslücken.",
                })}
              />
            </label>
            <label>
              {t("contextOptional", { defaultValue: "Zusätzlicher Kontext (optional)" })}
              <textarea
                style={{ ...fieldStyle, minHeight: 72, resize: "vertical" }}
                value={context}
                onChange={(event) => setContext(event.target.value)}
                maxLength={12000}
              />
            </label>
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
              {busy
                ? t("planning", { defaultValue: "Agenten planen …" })
                : t("createAgentPlan", { defaultValue: "Agenten automatisch koordinieren" })}
            </button>
          </form>

          {catalog.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0 }}>{t("activeAgents", { defaultValue: "Verfügbare Agenten" })}</h3>
                <button
                  type="button"
                  onClick={loadAgentState}
                  style={{ ...buttonStyle, background: "#1e293b", color: "#f8fafc", padding: "7px 10px" }}
                >
                  {t("refresh", { defaultValue: "Aktualisieren" })}
                </button>
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {catalog.map((agent) => {
                  const learned = adaptationMap[agent.id];
                  return (
                    <article key={agent.id} style={cardStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                        <strong>{agent.name}</strong>
                        <span style={badgeStyle(agent.risk_level)}>{agent.risk_level}</span>
                      </div>
                      <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>
                        {agent.purpose}
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 8 }}>
                        {t("learningSignal", { defaultValue: "Lernsignal" })}: {learned?.feedback_count || 0} · {t("adjustment", { defaultValue: "Anpassung" })}: {learned?.learned_adjustment || 0}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {agentPlan && (
            <section style={{ marginTop: 18 }}>
              <h3 style={{ marginBottom: 8 }}>{t("agentPlan", { defaultValue: "Agentenplan" })}</h3>
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 10 }}>
                Run ID: {agentPlan.run_id}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {agentPlan.tasks?.map((task) => (
                  <article key={task.agent_id} style={cardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                      <div>
                        <strong>{task.agent_name}</strong>
                        <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>
                          {t("priority", { defaultValue: "Priorität" })}: {task.priority}/100 · {t("adaptation", { defaultValue: "Adaptation" })}: {task.adaptation_adjustment >= 0 ? "+" : ""}{task.adaptation_adjustment}
                        </div>
                      </div>
                      <span style={badgeStyle(task.risk_level)}>{task.risk_level}</span>
                    </div>
                    <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>
                      {task.task}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      {task.human_review_required && (
                        <span style={badgeStyle("review")}>
                          {t("humanReview", { defaultValue: "Human Review" })}
                        </span>
                      )}
                      {task.safe_to_auto_execute && (
                        <span style={badgeStyle("auto")}>
                          {t("safeAuto", { defaultValue: "Auto-ausführbar" })}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
                      <button
                        type="button"
                        disabled={Boolean(feedbackBusy)}
                        onClick={() => submitFeedback(task, "completed", 5)}
                        style={{ ...buttonStyle, padding: "7px 6px", background: "#14532d", color: "#dcfce7", fontSize: 11 }}
                      >
                        {feedbackBusy === `${task.agent_id}:completed` ? "…" : t("completed", { defaultValue: "Erledigt" })}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(feedbackBusy)}
                        onClick={() => submitFeedback(task, "accepted", 4)}
                        style={{ ...buttonStyle, padding: "7px 6px", background: "#164e63", color: "#cffafe", fontSize: 11 }}
                      >
                        {feedbackBusy === `${task.agent_id}:accepted` ? "…" : t("accepted", { defaultValue: "Gut" })}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(feedbackBusy)}
                        onClick={() => submitFeedback(task, "corrected", 3)}
                        style={{ ...buttonStyle, padding: "7px 6px", background: "#713f12", color: "#fef3c7", fontSize: 11 }}
                      >
                        {feedbackBusy === `${task.agent_id}:corrected` ? "…" : t("corrected", { defaultValue: "Korrigiert" })}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(feedbackBusy)}
                        onClick={() => submitFeedback(task, "failed", 1)}
                        style={{ ...buttonStyle, padding: "7px 6px", background: "#7f1d1d", color: "#fee2e2", fontSize: 11 }}
                      >
                        {feedbackBusy === `${task.agent_id}:failed` ? "…" : t("failed", { defaultValue: "Fehler" })}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.5 }}>
                {agentPlan.governance_note}
              </p>
            </section>
          )}
        </>
      )}

      {mode === "ims" && (
        <>
          <p style={{ marginTop: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
            {t("autopilotDescription")}
          </p>
          <form onSubmit={runImsAutopilot}>
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

          {imsResult && (
            <section style={{ marginTop: 18 }}>
              <h3 style={{ marginBottom: 8 }}>{t("generatedArtifacts")}</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {imsResult.artifacts?.map((artifact) => (
                  <article key={artifact.id} style={cardStyle}>
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
        </>
      )}
    </aside>
  );
}
