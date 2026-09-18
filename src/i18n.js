const LOCALE_KEY = "safety360.locale";

const RTL_LANGUAGES = new Set([
  "ar",
  "dv",
  "fa",
  "he",
  "ku",
  "ps",
  "sd",
  "ug",
  "ur",
  "yi",
]);

export function normalizeLocale(value) {
  const candidate = String(value || "").trim().replace(/_/g, "-");
  if (!candidate) return "de";

  try {
    return Intl.getCanonicalLocales(candidate)[0] || "de";
  } catch {
    return "de";
  }
}

export function getLocale() {
  const stored = window.localStorage.getItem(LOCALE_KEY);
  if (stored) return normalizeLocale(stored);

  return normalizeLocale(navigator.language || navigator.languages?.[0] || "de");
}

export function setLocale(locale) {
  const normalized = normalizeLocale(locale);
  window.localStorage.setItem(LOCALE_KEY, normalized);
  setDocumentLocale(normalized);
  return normalized;
}

export function isRtlLocale(locale) {
  const language = normalizeLocale(locale).split("-")[0].toLowerCase();
  return RTL_LANGUAGES.has(language);
}

export function setDocumentLocale(locale) {
  const normalized = normalizeLocale(locale);
  document.documentElement.lang = normalized;
  document.documentElement.dir = isRtlLocale(normalized) ? "rtl" : "ltr";
}

export function formatDate(value, locale = getLocale(), options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(normalizeLocale(locale), options).format(date);
}

export function formatNumber(value, locale = getLocale(), options = {}) {
  return new Intl.NumberFormat(normalizeLocale(locale), options).format(value);
}

export function formatUnit(value, unit, locale = getLocale(), options = {}) {
  return new Intl.NumberFormat(normalizeLocale(locale), {
    style: "unit",
    unit,
    ...options,
  }).format(value);
}

export { LOCALE_KEY };
