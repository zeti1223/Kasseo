import { describe, it, expect } from "vitest";
import { formatCompactNumber, formatCurrency } from "@/utils/format";

describe("format.js", () => {
  describe("formatCompactNumber", () => {
    it("returns '0' for empty/falsy/invalid values", () => {
      expect(formatCompactNumber(null)).toBe("0");
      expect(formatCompactNumber(undefined)).toBe("0");
      expect(formatCompactNumber("")).toBe("0");
      expect(formatCompactNumber(NaN)).toBe("0");
      expect(formatCompactNumber("abc")).toBe("0");
      expect(formatCompactNumber(0)).toBe("0");
    });

    it("formats small numbers without suffixes", () => {
      expect(formatCompactNumber(5)).toBe("5");
      expect(formatCompactNumber(12.34)).toBe("12.34");
      expect(formatCompactNumber(999)).toBe("999");
      expect(formatCompactNumber(999.4)).toBe("999.4");
    });

    it("formats thousands with 'k' suffix", () => {
      expect(formatCompactNumber(1000)).toBe("1k");
      expect(formatCompactNumber(1500)).toBe("1.5k");
      expect(formatCompactNumber(12345)).toBe("12.35k");
      expect(formatCompactNumber(999950)).toBe("999.95k");
    });

    it("formats millions with 'M' suffix", () => {
      expect(formatCompactNumber(1000000)).toBe("1M");
      expect(formatCompactNumber(1234567)).toBe("1.23M");
      expect(formatCompactNumber(50000000)).toBe("50M");
    });

    it("formats billions with 'B' suffix", () => {
      expect(formatCompactNumber(1000000000)).toBe("1B");
      expect(formatCompactNumber(2500000000)).toBe("2.5B");
    });

    it("handles negative numbers correctly", () => {
      expect(formatCompactNumber(-5)).toBe("-5");
      expect(formatCompactNumber(-1500)).toBe("-1.5k");
      expect(formatCompactNumber(-2500000)).toBe("-2.5M");
      expect(formatCompactNumber(-3000000000)).toBe("-3B");
    });
  });

  describe("formatCurrency", () => {
    it("formats amount with currency suffix", () => {
      expect(formatCurrency(1500, "EUR")).toBe("1.5k EUR");
      expect(formatCurrency(100, "USD")).toBe("100 USD");
      expect(formatCurrency(-50000, "HUF")).toBe("-50k HUF");
    });

    it("formats amount without currency suffix if not provided", () => {
      expect(formatCurrency(1500)).toBe("1.5k");
      expect(formatCurrency(1500, "")).toBe("1.5k");
    });
  });
});
