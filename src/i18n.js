import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const STORAGE_KEY = "safety360.language";

const resources = {
  de: {
    translation: {
      appName: "Safety360",
      controlCenter: "Safety360 Control Center",
      login: "Anmelden",
      register: "Registrieren",
      logout: "Abmelden",
      dashboard: "Übersicht",
      documents: "Dokumente",
      tickets: "Tickets",
      organization: "Organisation",
      assistant: "KI-Assistent",
      ims: "IMS-Module",
      language: "Sprache",
      loading: "Safety360 wird geladen …",
      installApp: "App installieren",
      translationNotice: "Maschinelle Übersetzungen kritischer Inhalte müssen vor verbindlicher Nutzung fachlich geprüft werden.",
    },
  },
  en: {
    translation: {
      appName: "Safety360",
      controlCenter: "Safety360 Control Center",
      login: "Sign in",
      register: "Register",
      logout: "Sign out",
      dashboard: "Overview",
      documents: "Documents",
      tickets: "Tickets",
      organization: "Organization",
      assistant: "AI Assistant",
      ims: "IMS Modules",
      language: "Language",
      loading: "Safety360 is loading …",
      installApp: "Install app",
      translationNotice: "Machine-translated critical content must be professionally reviewed before binding use.",
    },
  },
  tr: {
    translation: {
      appName: "Safety360",
      controlCenter: "Safety360 Kontrol Merkezi",
      login: "Giriş yap",
      register: "Kayıt ol",
      logout: "Çıkış yap",
      dashboard: "Genel bakış",
      documents: "Belgeler",
      tickets: "Kayıtlar",
      organization: "Organizasyon",
      assistant: "Yapay Zekâ Asistanı",
      ims: "IMS Modülleri",
      language: "Dil",
      loading: "Safety360 yükleniyor …",
      installApp: "Uygulamayı yükle",
      translationNotice: "Kritik içeriklerin makine çevirileri bağlayıcı kullanımdan önce uzman tarafından kontrol edilmelidir.",
    },
  },
  fa: {
    translation: {
      appName: "Safety360",
      controlCenter: "مرکز کنترل Safety360",
      login: "ورود",
      register: "ثبت‌نام",
      logout: "خروج",
      dashboard: "نمای کلی",
      documents: "اسناد",
      tickets: "درخواست‌ها",
      organization: "سازمان",
      assistant: "دستیار هوش مصنوعی",
      ims: "ماژول‌های IMS",
      language: "زبان",
      loading: "Safety360 در حال بارگذاری است …",
      installApp: "نصب برنامه",
      translationNotice: "ترجمه ماشینی محتوای حساس باید پیش از استفاده الزام‌آور توسط متخصص بررسی شود.",
    },
  },
  ar: {
    translation: {
      appName: "Safety360",
      controlCenter: "مركز تحكم Safety360",
      login: "تسجيل الدخول",
      register: "إنشاء حساب",
      logout: "تسجيل الخروج",
      dashboard: "نظرة عامة",
      documents: "المستندات",
      tickets: "التذاكر",
      organization: "المؤسسة",
      assistant: "مساعد الذكاء الاصطناعي",
      ims: "وحدات IMS",
      language: "اللغة",
      loading: "يتم تحميل Safety360 …",
      installApp: "تثبيت التطبيق",
      translationNotice: "يجب مراجعة الترجمات الآلية للمحتوى الحساس مهنياً قبل الاستخدام الملزم.",
    },
  },
};

const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
const browserLanguage = navigator.language || "de";
const initialLanguage = savedLanguage || browserLanguage;

function applyDocumentDirection(language) {
  const primary = String(language || "de").toLowerCase().split("-")[0];
  const rtl = new Set(["ar", "fa", "he", "ur"]);
  document.documentElement.lang = language || "de";
  document.documentElement.dir = rtl.has(primary) ? "rtl" : "ltr";
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
  });

applyDocumentDirection(i18n.language);

i18n.on("languageChanged", (language) => {
  window.localStorage.setItem(STORAGE_KEY, language);
  applyDocumentDirection(language);
});

export const coreLanguages = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "tr", label: "Türkçe" },
  { code: "fa", label: "فارسی" },
  { code: "ar", label: "العربية" },
];

export default i18n;
