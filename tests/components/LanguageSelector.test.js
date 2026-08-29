import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import LanguageSelector from "@/components/common/LanguageSelector.vue";
import { useSettingsStore } from "@/stores/settings";

describe("LanguageSelector.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("renders pills variant with language buttons", async () => {
    const wrapper = mount(LanguageSelector, {
      props: {
        variant: "pills",
      },
    });

    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBeGreaterThan(3);
    expect(wrapper.text()).toContain("English");
    expect(wrapper.text()).toContain("Magyar");
  });

  it("changes store language when a language button is clicked in pills variant", async () => {
    const wrapper = mount(LanguageSelector, {
      props: {
        variant: "pills",
      },
    });

    const settingsStore = useSettingsStore();
    const huButton = wrapper.findAll("button").find((btn) => btn.text().includes("Magyar"));
    expect(huButton).toBeDefined();

    await huButton.trigger("click");
    expect(settingsStore.language).toBe("hu");
  });

  it("toggles dropdown when clicked in navbar variant", async () => {
    const wrapper = mount(LanguageSelector, {
      props: {
        variant: "navbar",
      },
    });

    const triggerBtn = wrapper.find("button");
    expect(wrapper.find(".fixed.inset-0").exists()).toBe(false);

    await triggerBtn.trigger("click");
    expect(wrapper.find(".fixed.inset-0").exists()).toBe(true);
  });
});
