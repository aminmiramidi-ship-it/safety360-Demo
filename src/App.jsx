import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { API_BASE_URL, api, getToken, setToken } from "./api.js";

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [language, setLanguage] = useState("de");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (mode === "register") {
        await api.register({
          email,
          password,
          full_name: fullName || null,
          language,
        });
      }

      const tokenData = await api.login({ email, password });
      setToken(tokenData.access_token);
      await onAuthenticated();
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <div className="brand-mark">S360</div>
        <p className="eyebrow">Integrated Management System</p>
        <h1>Safety360</h1>
        <p className="hero-copy">
          Arbeitssicherheit, Umwelt, Energie und Qualität in einer mandantenfähigen Plattform.
        </p>
        <div className="feature-grid">
          <span>ISO 45001</span>
          <span>ISO 14001</span>
          <span>ISO 50001</span>
          <span>ISO 9001</span>
        </div>
        <p className="system-note">API: {API_BASE_URL}</p>
      </section>

      <section className="auth-card">
        <div className="tabs" role="tablist" aria-label="Anmeldung oder Registrierung">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
            Anmelden
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
            Registrieren
          </button>
        </div>

        <h2>{mode === "login" ? "Willkommen zurück" : "Safety360 Zugang anlegen"}</h2>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
            </label>
          )}
          <label>
            E-Mail
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Passwort
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {mode === "register" && (
            <label>
              Sprache
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
          )}
          {error && <div className="alert error">{error}</div>}
          <button className="primary" disabled={busy} type="submit">
            {busy ? "Bitte warten …" : mode === "login" ? "Anmelden" : "Registrieren & anmelden"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ user, onLogout }) {
  const [tenant, setTenant] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [companyName, setCompanyName] = useState("");
  const [ticketText, setTicketText] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const initials = useMemo(() => {
    const source = user?.full_name || user?.email || "S360";
    return source
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [user]);

  async function refresh() {
    setError("");
    const [tenantResult, ticketResult] = await Promise.allSettled([
      api.currentTenant(),
      api.listTickets(),
    ]);

    if (tenantResult.status === "fulfilled") {
      setTenant(tenantResult.value);
    } else if (tenantResult.reason?.status !== 404) {
      setError(tenantResult.reason?.message || "Mandant konnte nicht geladen werden.");
    }

    if (ticketResult.status === "fulfilled") {
      setTickets(ticketResult.value.tickets || []);
    } else {
      setError(ticketResult.reason?.message || "Tickets konnten nicht geladen werden.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createTenant(event) {
    event.preventDefault();
    if (!companyName.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await api.createTenant({ name: companyName.trim() });
      setTenant(created);
      setCompanyName("");
      setNotice("Mandant wurde angelegt. Deine Rolle wurde auf Tenant Admin aktualisiert.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function createTicket(event) {
    event.preventDefault();
    if (!ticketText.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.createTicket({ description: ticketText.trim(), status: "open" });
      setTicketText("");
      setNotice("Ticket wurde erstellt und revisionsnah protokolliert.");
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-row">
            <div className="brand-mark small">S360</div>
            <div>
              <strong>Safety360</strong>
              <span>IMS Workspace</span>
            </div>
          </div>
          <nav>
            <a className="active" href="#overview">Übersicht</a>
            <a href="#tickets">Tickets</a>
            <a href="#ims">IMS Module</a>
            <a href="#tenant">Organisation</a>
          </nav>
        </div>
        <button className="secondary" onClick={onLogout} type="button">Abmelden</button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Safety360 Control Center</p>
            <h1>Guten Tag, {user?.full_name || user?.email}</h1>
          </div>
          <div className="user-chip">
            <span className="avatar">{initials}</span>
            <div>
              <strong>{user?.role || "user"}</strong>
              <span>{tenant?.name || "Noch kein Mandant"}</span>
            </div>
          </div>
        </header>

        {notice && <div className="alert success">{notice}</div>}
        {error && <div className="alert error">{error}</div>}

        <section id="overview" className="metric-grid">
          <article><span>Mandant</span><strong>{tenant?.name || "Nicht eingerichtet"}</strong></article>
          <article><span>Offene Tickets</span><strong>{tickets.filter((ticket) => ticket.status === "open").length}</strong></article>
          <article><span>Sprache</span><strong>{(user?.language || "de").toUpperCase()}</strong></article>
          <article><span>Account</span><strong>{user?.is_active ? "Aktiv" : "Deaktiviert"}</strong></article>
        </section>

        {!tenant && (
          <section id="tenant" className="panel onboarding-panel">
            <div>
              <p className="eyebrow">Eiffelturm – Ebene Organisation</p>
              <h2>Unternehmen einrichten</h2>
              <p>Lege den ersten Mandanten an. Danach werden Benutzer, Tickets und spätere HSE-/IMS-Objekte diesem Unternehmen zugeordnet.</p>
            </div>
            <form onSubmit={createTenant} className="inline-form">
              <input
                placeholder="z. B. Muster GmbH"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
              <button className="primary" disabled={busy} type="submit">Mandant anlegen</button>
            </form>
          </section>
        )}

        <section id="ims" className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Integrated Management System</p>
              <h2>Modulstruktur</h2>
            </div>
          </div>
          <div className="module-grid">
            <article><span>01</span><h3>Gefährdungsbeurteilung</h3><p>Risiken, Tätigkeiten, Schutzmaßnahmen und Verantwortungen.</p></article>
            <article><span>02</span><h3>Betriebsanweisungen</h3><p>Verknüpfte Anweisungen mit Versionierung und Freigaben.</p></article>
            <article><span>03</span><h3>Unterweisungen</h3><p>Zielgruppen, Nachweise, Fälligkeiten und Qualifikationen.</p></article>
            <article><span>04</span><h3>Audits & Reviews</h3><p>Findings, Maßnahmen, Wirksamkeit und Management Review.</p></article>
          </div>
        </section>

        <section id="tickets" className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Corrective Action Workflow</p>
              <h2>Tickets</h2>
            </div>
            <span className="badge">{tickets.length} gesamt</span>
          </div>

          <form onSubmit={createTicket} className="ticket-form">
            <textarea
              placeholder="Abweichung, Maßnahme oder Verbesserung beschreiben …"
              value={ticketText}
              onChange={(event) => setTicketText(event.target.value)}
            />
            <button className="primary" disabled={busy} type="submit">Ticket erstellen</button>
          </form>

          <div className="ticket-list">
            {tickets.length === 0 ? (
              <p className="empty">Noch keine Tickets vorhanden.</p>
            ) : (
              tickets.map((ticket) => (
                <article key={ticket.id}>
                  <div>
                    <strong>#{ticket.id}</strong>
                    <p>{ticket.description}</p>
                  </div>
                  <span className={`status ${ticket.status}`}>{ticket.status}</span>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  async function loadUser() {
    try {
      const currentUser = await api.me();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      if (error.status === 401) {
        setToken(null);
        setUser(null);
      }
      throw error;
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (getToken()) {
      loadUser().catch(() => undefined);
    }
  }, []);

  function logout() {
    setToken(null);
    setUser(null);
  }

  if (checking) {
    return <div className="loading-screen">Safety360 wird geladen …</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <AuthPage onAuthenticated={loadUser} />}
      />
      <Route
        path="/dashboard"
        element={user ? <Dashboard user={user} onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}
