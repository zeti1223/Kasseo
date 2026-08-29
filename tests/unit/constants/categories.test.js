import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_I18N_KEYS,
  PRESET_ICONS,
  getCategoryIcon,
  getCategoryLabel,
} from "@/constants/categories";

describe("categories.js", () => {
  it("exports CATEGORIES and CATEGORY_ICONS", () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
    expect(CATEGORY_ICONS["Food & Groceries"]).toBe("fas fa-utensils");
    expect(CATEGORY_ICONS["Other"]).toBe("fas fa-tag");
  });

  it("exports PRESET_ICONS with icons and labels", () => {
    expect(PRESET_ICONS.length).toBeGreaterThan(10);
    expect(PRESET_ICONS[0]).toHaveProperty("icon");
    expect(PRESET_ICONS[0]).toHaveProperty("label");
  });

  describe("getCategoryIcon", () => {
    it("returns custom icon if provided", () => {
      expect(getCategoryIcon("Food & Groceries", "fas fa-pizza-slice")).toBe(
        "fas fa-pizza-slice",
      );
    });

    it("returns mapped standard category icon", () => {
      expect(getCategoryIcon("Food & Groceries")).toBe("fas fa-utensils");
      expect(getCategoryIcon("Transport")).toBe("fas fa-car");
    });

    it("returns fallback icon for unknown or empty categories", () => {
      expect(getCategoryIcon("Unknown Category")).toBe("fas fa-tag");
      expect(getCategoryIcon(null)).toBe("fas fa-tag");
    });
  });

  describe("getCategoryLabel", () => {
    it("returns empty string for empty input", () => {
      expect(getCategoryLabel("")).toBe("");
      expect(getCategoryLabel(null)).toBe("");
    });

    it("uses translation helper when available", () => {
      const mockT = (key) => `translated:${key}`;
      expect(getCategoryLabel("Food & Groceries", mockT)).toBe(
        "translated:categories.foodAndGroceries",
      );
    });

    it("returns categoryName directly if no i18n key exists", () => {
      expect(getCategoryLabel("Custom Category Name")).toBe("Custom Category Name");
    });
  });
});
