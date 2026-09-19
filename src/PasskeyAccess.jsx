import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import { apiRequest } from "./api.js";
import {
  isWebAuthnAvailable,
  prepareAuthenticationOptions,
  prepareRegistrationOptions,
  serializePublicKeyCredential,
} from "./webauthn.js";
import "./passkey-access.css";

const passkeyApi = {
  capabilities: () => apiRequest("/auth/passkeys/capabilities"),
  list: () => apiRequest("/auth/passkeys"),
  registrationOptions: () => apiRequest("/auth/passkeys/registration/options", { method: "POST" }),
  registrationVerify: (payload) =>
    apiRequest("/auth/passkeys/registration/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  authenticationOptions: () => apiRequest("/auth/passkeys/authentication/options", { method: "POST" }),
  authenticationVerify: (payload) =>
    apiRequest("/auth/passkeys/authentication/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  revoke: (passkeyId) =>
    apiRequest(`/auth/passkeys/${encodeURIComponent(passkeyId)}`, { method: "DELETE" }),
};

function friendlyPasskeyError(error) {
  if (error?.name === "NotAllowedError" || error?.name === "AbortError") {
    return "Passkey-Vorgang wurde abgebrochen oder nicht bestätigt.";
  }
  if (error?.name === "InvalidStateError") {
    return "Dieser Passkey ist bereits für Safety360 registriert.";
  }
  return error?.message || "Passkey-Vorgang konnte nicht abgeschlossen werden.";
}

export default function PasskeyAccess() {
  const location = useLocation();
  const [portalTarget, setPortalTarget] = useState(null);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [passkeys, setPasskeys] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isLogin = location.pathname === "/login";
  const isDashboard = location.pathname === "/dashboard";

  useEffect(() => {
    let cancelled = false;
    let observer;

    async function detect() {
      if (!isWebAuthnAvailable()) return;
      try {
        const capabilities = await passkeyApi.capabilities();
        if (!cancelled) setAvailable(Boolean(capabilities?.enabled));
      } catch {
        if (!cancelled) setAvailable(false);
      }
    }

    function findTarget() {
      const target = isLogin
        ? document.querySelector(".auth-card")
        : isDashboard
          ? document.querySelector(".topbar")
          : null;
      if (target) setPortalTarget(target);
    }

    setPortalTarget(null);
    setOpen(false);
    setError("");
    setMessage("");
    findTarget();
    observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    detect();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [isDashboard, isLogin]);

  async function authenticate() {
    setBusy(true);
    setError("");
    try {
      const options = await passkeyApi.authenticationOptions();
      const credential = await navigator.credentials.get({
        publicKey: prepareAuthenticationOptions(options.public_key),
      });
      await passkeyApi.authenticationVerify({
        ceremony_id: options.ceremony_id,
        credential: serializePublicKeyCredential(credential),
      });
      window.location.assign("/dashboard");
    } catch (requestError) {
      setError(friendlyPasskeyError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function loadPasskeys() {
    setBusy(true);
    setError("");
    try {
      setPasskeys(await passkeyApi.list());
    } catch (requestError) {
      setError(friendlyPasskeyError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function openManager() {
    setOpen(true);
    setMessage("");
    await loadPasskeys();
  }

  async function registerPasskey() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const options = await passkeyApi.registrationOptions();
      const credential = await navigator.credentials.create({
        publicKey: prepareRegistrationOptions(options.public_key),
      });
      await passkeyApi.registrationVerify({
        ceremony_id: options.ceremony_id,
        credential: serializePublicKeyCredential(credential),
        nickname: null,
      });
      setMessage("Passkey wurde registriert.");
      setPasskeys(await passkeyApi.list());
    } catch (requestError) {
      setError(friendlyPasskeyError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function revokePasskey(passkeyId) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await passkeyApi.revoke(passkeyId);
      setMessage("Passkey wurde widerrufen.");
      setPasskeys(await passkeyApi.list());
    } catch (requestError) {
      setError(friendlyPasskeyError(requestError));
    } finally {
      setBusy(false);
    }
  }

  if (!available || !portalTarget || (!isLogin && !isDashboard)) return null;

  if (isLogin) {
    return createPortal(
      <div className="passkey-login">
        <div className="passkey-divider"><span>oder</span></div>
        <button className="secondary passkey-login-button" disabled={busy} onClick={authenticate} type="button">
          {busy ? "Passkey wird geprüft …" : "Mit Passkey anmelden"}
        </button>
        {error && <div className="alert error passkey-message" role="alert">{error}</div>}
      </div>,
      portalTarget,
    );
  }

  return createPortal(
    <>
      <button className="secondary passkey-manage-button" onClick={openManager} type="button">
        Passkeys
      </button>
      {open && (
        <div className="passkey-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="passkey-dialog" role="dialog" aria-modal="true" aria-labelledby="passkey-title">
            <div className="passkey-dialog-heading">
              <div>
                <p className="eyebrow">Account Security</p>
                <h2 id="passkey-title">Passkeys verwalten</h2>
              </div>
              <button className="secondary" onClick={() => setOpen(false)} type="button">Schließen</button>
            </div>
            <p>Passkeys verwenden die Geräteentsperrung und ersetzen beim Anmelden das Passwort. Sicherheitsänderungen benötigen eine aktuelle Browser-Anmeldung.</p>
            {message && <div className="alert success" role="status">{message}</div>}
            {error && <div className="alert error" role="alert">{error}</div>}
            <button className="primary" disabled={busy} onClick={registerPasskey} type="button">
              {busy ? "Bitte warten …" : "Passkey hinzufügen"}
            </button>
            <div className="passkey-list">
              {passkeys.length === 0 ? (
                <p className="empty">Noch kein Passkey registriert.</p>
              ) : (
                passkeys.map((passkey) => (
                  <article key={passkey.id}>
                    <div>
                      <strong>{passkey.nickname || "Passkey"}</strong>
                      <small>{passkey.credential_id_hint} · {passkey.backed_up ? "synchronisiert" : "nicht als synchronisiert gemeldet"}</small>
                    </div>
                    {passkey.revoked_at ? (
                      <span className="status closed">Widerrufen</span>
                    ) : (
                      <button className="secondary" disabled={busy} onClick={() => revokePasskey(passkey.id)} type="button">
                        Widerrufen
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </>,
    portalTarget,
  );
}
