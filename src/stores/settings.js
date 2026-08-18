import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";

const VALID_MODES = ["light", "system", "dark"];
const media = window.matchMedia("(prefers-color-scheme: dark)");

export const useSettingsStore = defineStore("settings", () => {
  // "light" | "system" | "dark"
  const themeMode = ref("system");
  const nickname = ref("");

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

  return {
    themeMode,
    isDarkMode,
    nickname,
    loadSettings,
    setThemeMode,
    setNickname,
  };
});
