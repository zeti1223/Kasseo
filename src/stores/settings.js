import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import i18next, { SUPPORTED_LANGUAGES, initialLanguage } from "@/i18n";

const VALID_MODES = ["light", "system", "dark"];
const media = window.matchMedia("(prefers-color-scheme: dark)");

export const useSettingsStore = defineStore("settings", () => {
  // "light" | "system" | "dark"
  const themeMode = ref("system");
  const nickname = ref("");
  const language = ref(initialLanguage);

  // Kept in sync via a listener below
  const systemPrefersDark = ref(media.matches);

  // The effective boolean that toggles the "dark" class
  const isDarkMode = computed(() =>
    themeMode.value === "system"
      ? systemPrefersDark.value
      : themeMode.value === "dark",
  );

  function handleSystemChange(e) {
    systemPrefersDark.value = e.matches;
  }
  media.addEventListener("change", handleSystemChange);

  function loadSettings() {
    const savedThemeMode = localStorage.getItem("themeMode");
    const savedNickname = localStorage.getItem("nickname");
    const savedLanguage = localStorage.getItem("language");

    if (savedThemeMode !== null && VALID_MODES.includes(savedThemeMode)) {
      themeMode.value = savedThemeMode;
    } else {
      // Migrate from the old boolean "darkMode" key if present
      const legacyDarkMode = localStorage.getItem("darkMode");
      if (legacyDarkMode !== null) {
        themeMode.value = legacyDarkMode === "true" ? "dark" : "light";
      }
    }

    if (savedNickname !== null) {
      nickname.value = savedNickname;
    }

    if (
      savedLanguage !== null &&
      SUPPORTED_LANGUAGES.some((l) => l.code === savedLanguage)
    ) {
      setLanguage(savedLanguage);
    } else {
      setLanguage(language.value);
    }

    applyTheme(isDarkMode.value);
  }

  // Watch for changes and save to localStorage
  watch(themeMode, (newValue) => {
    localStorage.setItem("themeMode", newValue);
  });

  watch(isDarkMode, (newValue) => {
    applyTheme(newValue);
  });

  watch(nickname, (newValue) => {
    localStorage.setItem("nickname", newValue);
  });

  watch(language, (newValue) => {
    localStorage.setItem("language", newValue);
    if (i18next.language !== newValue) {
      i18next.changeLanguage(newValue);
    }
  });

  function applyTheme(dark) {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  function setThemeMode(mode) {
    if (VALID_MODES.includes(mode)) {
      themeMode.value = mode;
    }
  }

  function setNickname(newNickname) {
    nickname.value = newNickname;
  }

  function setLanguage(newLanguage) {
    if (SUPPORTED_LANGUAGES.some((l) => l.code === newLanguage)) {
      language.value = newLanguage;
      i18next.changeLanguage(newLanguage);
    }
  }

  return {
    themeMode,
    isDarkMode,
    nickname,
    language,
    loadSettings,
    setThemeMode,
    setNickname,
    setLanguage,
  };
});
