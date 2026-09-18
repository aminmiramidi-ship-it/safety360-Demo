import { useTranslation } from "react-i18next";

import { coreLanguages } from "./i18n.js";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentPrimary = String(i18n.language || "de").split("-")[0];

  return (
    <div
      aria-label={t("language")}
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 10,
        background: "rgba(15, 23, 42, 0.92)",
        color: "white",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      }}
    >
      <span style={{ fontSize: 12 }}>{t("language")}</span>
      <select
        aria-label={t("language")}
        value={coreLanguages.some((item) => item.code === currentPrimary) ? currentPrimary : "en"}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        style={{
          borderRadius: 6,
          padding: "4px 6px",
          background: "white",
          color: "#0f172a",
        }}
      >
        {coreLanguages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </div>
  );
}
