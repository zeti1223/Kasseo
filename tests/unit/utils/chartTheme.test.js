import { describe, it, expect, vi } from "vitest";
import {
  formatMoney,
  cartesianOptions,
  radialOptions,
  areaGradient,
} from "@/utils/chartTheme";

describe("chartTheme.js", () => {
  describe("formatMoney", () => {
    it("formats amount with and without currency", () => {
      expect(formatMoney(1500, "EUR")).toBe("1.5k EUR");
      expect(formatMoney(50)).toBe("50");
    });
  });

  describe("cartesianOptions", () => {
    it("returns configuration object for cartesian charts", () => {
      const options = cartesianOptions("USD");
      expect(options.responsive).toBe(true);
      expect(options.plugins.tooltip).toBeDefined();
      expect(options.scales.x).toBeDefined();
      expect(options.scales.y).toBeDefined();
      expect(typeof options.scales.y.ticks.callback).toBe("function");
      expect(options.scales.y.ticks.callback(5000)).toBe("5k USD");
    });
  });

  describe("radialOptions", () => {
    it("returns configuration object for radial charts", () => {
      const options = radialOptions("EUR");
      expect(options.responsive).toBe(true);
      expect(options.cutout).toBe("62%");
      expect(options.plugins.tooltip.callbacks.label).toBeDefined();

      const mockCtx = {
        label: "Food",
        parsed: 50,
        dataset: { data: [50, 50] },
      };
      const labelStr = options.plugins.tooltip.callbacks.label(mockCtx);
      expect(labelStr).toContain("Food: 50 EUR (50%)");
    });
  });

  describe("areaGradient", () => {
    it("returns colorHex fallback if chartArea is null", () => {
      expect(areaGradient(null, null, "#C8A5FC")).toBe("#C8A5FC");
    });

    it("creates a linear gradient when chartArea is provided", () => {
      const mockGradient = { addColorStop: vi.fn() };
      const mockCtx = {
        createLinearGradient: vi.fn(() => mockGradient),
      };
      const chartArea = { top: 0, bottom: 200 };

      const result = areaGradient(mockCtx, chartArea, "#C8A5FC");
      expect(mockCtx.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 200);
      expect(mockGradient.addColorStop).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockGradient);
    });
  });
});
