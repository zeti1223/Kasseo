import i18next from "i18next";
import en from "./locales/en.json";
import hu from "./locales/hu.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", flagClass: "fi fi-gb" },
  { code: "de", name: "Deutsch", flagClass: "fi fi-de" },
  { code: "fr", name: "Français", flagClass: "fi fi-fr" },
  { code: "es", name: "Español", flagClass: "fi fi-es" },
  { code: "hu", name: "Magyar", flagClass: "fi fi-hu" },
];

export function getInitialLanguage() {
  const saved = localStorage.getItem("language");
  if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
    return saved;
  }
  const browserLang = navigator.language?.split("-")[0]?.toLowerCase();
  if (browserLang && SUPPORTED_LANGUAGES.some((l) => l.code === browserLang)) {
    return browserLang;
  }
  return "en";
}

export const initialLanguage = getInitialLanguage();

i18next.init({
  lng: initialLanguage,
  fallbackLng: "en",
  debug: false,
  resources: {
    en: { translation: en },
    hu: { translation: hu },
    de: { translation: de },
    fr: { translation: fr },
    es: { translation: es },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
