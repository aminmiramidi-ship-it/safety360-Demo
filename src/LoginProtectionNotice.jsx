import { useEffect, useState } from "react";

import { LOGIN_PROTECTION_EVENT } from "./api.js";

function formatRemaining(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  if (minutes <= 0) return `${remainder} Sek.`;
  return `${minutes}:${String(remainder).padStart(2, "0")} Min.`;
}

export default function LoginProtectionNotice() {
  const [remaining, setRemaining] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function handleProtection(event) {
      const retryAfter = Number(event.detail?.retryAfter || 0);
      if (!Number.isFinite(retryAfter) || retryAfter <= 0) return;
      setRemaining(Math.ceil(retryAfter));
      setMessage(
        event.detail?.message ||
          "Zum Schutz deines Kontos sind weitere Anmeldeversuche vorübergehend begrenzt.",
      );
    }

    window.addEventListener(LOGIN_PROTECTION_EVENT, handleProtection);
    return () => window.removeEventListener(LOGIN_PROTECTION_EVENT, handleProtection);
  }, []);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const timer = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining > 0]);

  if (remaining <= 0) return null;

  return (
    <aside
      aria-live="polite"
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "1rem",
        zIndex: 10000,
        width: "min(92vw, 38rem)",
        transform: "translateX(-50%)",
        padding: "0.9rem 1rem",
        border: "1px solid currentColor",
        borderRadius: "0.8rem",
        background: "Canvas",
        color: "CanvasText",
        boxShadow: "0 0.75rem 2rem rgba(0, 0, 0, 0.18)",
      }}
    >
      <strong>Anmeldeschutz aktiv</strong>
      <div style={{ marginTop: "0.35rem" }}>{message}</div>
      <small style={{ display: "block", marginTop: "0.45rem" }}>
        Erneuter Versuch in ungefähr {formatRemaining(remaining)}
      </small>
    </aside>
  );
}
