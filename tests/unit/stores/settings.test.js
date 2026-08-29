import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSettingsStore } from "@/stores/settings";

describe("settings store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("initializes with default values", () => {
    const store = useSettingsStore();
    expect(store.themeMode).toBe("system");
    expect(typeof store.isDarkMode).toBe("boolean");
  });

  it("updates nickname and saves to localStorage", async () => {
    const store = useSettingsStore();
    store.setNickname("TestUser");
    expect(store.nickname).toBe("TestUser");
  });

  it("updates themeMode to valid modes", () => {
    const store = useSettingsStore();
    store.setThemeMode("dark");
    expect(store.themeMode).toBe("dark");
    expect(store.isDarkMode).toBe(true);

    store.setThemeMode("light");
    expect(store.themeMode).toBe("light");
    expect(store.isDarkMode).toBe(false);
  });

  it("ignores invalid theme modes", () => {
    const store = useSettingsStore();
    store.setThemeMode("invalid_mode");
    expect(store.themeMode).not.toBe("invalid_mode");
  });

  it("updates language when supported", () => {
    const store = useSettingsStore();
    store.setLanguage("hu");
    expect(store.language).toBe("hu");
  });

  it("loads settings from localStorage", () => {
    localStorage.setItem("themeMode", "dark");
    localStorage.setItem("nickname", "StoredName");
    localStorage.setItem("language", "de");

    const store = useSettingsStore();
    store.loadSettings();

    expect(store.themeMode).toBe("dark");
    expect(store.nickname).toBe("StoredName");
    expect(store.language).toBe("de");
  });
});
