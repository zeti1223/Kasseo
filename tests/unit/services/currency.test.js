import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getExchangeRate, convertCurrency } from "@/services/currency";

describe("currency.js service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 1 for same from and to currency without network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const rate = await getExchangeRate("EUR", "EUR", "2026-01-01");
    expect(rate).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches exchange rate from API and converts currency", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        amount: 1,
        base: "EUR",
        date: "2026-01-01",
        rates: { USD: 1.1 },
      }),
    });

    const result = await convertCurrency(100, "EUR", "USD", "2026-01-01");
    expect(result.amount).toBe(110);
    expect(result.rate).toBe(1.1);
    expect(result.rateDate).toBe("2026-01-01");
  });

  it("handles identical currency conversion directly", async () => {
    const result = await convertCurrency(50, "HUF", "HUF", "2026-01-01");
    expect(result.amount).toBe(50);
    expect(result.rate).toBe(1);
  });
});
