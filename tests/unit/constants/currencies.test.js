import { describe, it, expect } from "vitest";
import { CURRENCIES } from "@/constants/currencies";

describe("currencies.js", () => {
  it("exports a non-empty list of supported currency codes", () => {
    expect(Array.isArray(CURRENCIES)).toBe(true);
    expect(CURRENCIES).toContain("EUR");
    expect(CURRENCIES).toContain("USD");
    expect(CURRENCIES).toContain("HUF");
    expect(CURRENCIES).toContain("GBP");
  });
});
