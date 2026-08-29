import { describe, it, expect } from "vitest";
import {
  extractJsonArray,
  resolveCategory,
  ScanError,
} from "@/utils/receiptScan";

describe("receiptScan.js", () => {
  describe("extractJsonArray", () => {
    it("extracts plain JSON array string", () => {
      const json = '[{"name": "Milk", "price": 2.5}]';
      expect(extractJsonArray(json)).toEqual([{ name: "Milk", price: 2.5 }]);
    });

    it("extracts markdown fenced JSON codeblock", () => {
      const md = 'Here are items:\n```json\n[{"name": "Bread", "price": 1.5}]\n```\nDone.';
      expect(extractJsonArray(md)).toEqual([{ name: "Bread", price: 1.5 }]);
    });

    it("extracts markdown fenced codeblock without json tag", () => {
      const md = '```\n[{"name": "Apple"}]\n```';
      expect(extractJsonArray(md)).toEqual([{ name: "Apple" }]);
    });

    it("extracts array embedded within text", () => {
      const text = 'Items found: [{"name": "Cheese"}] hope this helps!';
      expect(extractJsonArray(text)).toEqual([{ name: "Cheese" }]);
    });

    it("returns null for invalid / unparsable strings", () => {
      expect(extractJsonArray("not json at all")).toBeNull();
      expect(extractJsonArray("[{ unclosed json")).toBeNull();
    });
  });

  describe("resolveCategory", () => {
    const allCategories = ["Food & Groceries", "Transport", "Other"];
    const overrides = { coffee: "Food & Groceries", taxi: "Transport" };

    it("matches overrides based on keyword in name", () => {
      expect(resolveCategory("Morning Coffee", "Other", allCategories, overrides)).toBe(
        "Food & Groceries",
      );
      expect(resolveCategory("Airport Taxi", null, allCategories, overrides)).toBe(
        "Transport",
      );
    });

    it("returns aiCategory if valid and in allCategories", () => {
      expect(
        resolveCategory("Random Item", "Food & Groceries", allCategories, {}),
      ).toBe("Food & Groceries");
    });

    it("falls back to 'Other' if no match or invalid category", () => {
      expect(
        resolveCategory("Random Item", "NonExistentCategory", allCategories, {}),
      ).toBe("Other");
      expect(resolveCategory("Random Item", null, allCategories, {})).toBe("Other");
    });
  });

  describe("ScanError", () => {
    it("correctly sets error message and code", () => {
      const err = new ScanError("Rate limit exceeded", "rate-limited");
      expect(err.message).toBe("Rate limit exceeded");
      expect(err.code).toBe("rate-limited");
      expect(err instanceof Error).toBe(true);
    });
  });
});
