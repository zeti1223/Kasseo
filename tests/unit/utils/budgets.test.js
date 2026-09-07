import { describe, it, expect } from "vitest";
import {
  getMonthRange,
  getCategorySpend,
  getBudgetStatus,
  computeBudgetProgress,
  categoryBudgetKey,
  getNewlyCrossedThreshold,
  getEffectiveBudgetLimit,
} from "@/utils/budgets";

describe("budgets.js", () => {
  const range = getMonthRange(new Date(2026, 2, 15)); // March 2026

  const transactions = [
    {
      id: "tx1",
      type: "expense",
      category: "Food & Groceries",
      amount: 100,
      date: "2026-03-05",
    },
    {
      id: "tx2",
      type: "expense",
      category: "Food & Groceries",
      amount: 50,
      date: "2026-03-20",
    },
    {
      id: "tx3",
      type: "expense",
      category: "Food & Groceries",
      amount: 999,
      date: "2026-02-20", // previous month, should be excluded
    },
    {
      id: "tx4",
      type: "deposit",
      category: "Deposit",
      amount: 500,
      date: "2026-03-10", // not an expense, should be excluded
    },
    {
      id: "tx5",
      type: "expense",
      category: "Transport",
      amount: 30,
      date: "2026-03-12",
    },
  ];

  describe("getMonthRange", () => {
    it("returns the first-of-month start and exclusive end bounds", () => {
      const { start, end } = getMonthRange(new Date(2026, 2, 15));
      expect(start.getMonth()).toBe(2);
      expect(start.getDate()).toBe(1);
      expect(end.getMonth()).toBe(3);
      expect(end.getDate()).toBe(1);
    });
  });

  describe("getCategorySpend", () => {
    it("sums only matching-category expenses within the range", () => {
      expect(getCategorySpend(transactions, "Food & Groceries", range)).toBe(150);
    });

    it("excludes non-expense transactions and other categories", () => {
      expect(getCategorySpend(transactions, "Transport", range)).toBe(30);
    });

    it("returns 0 when there is no matching spend", () => {
      expect(getCategorySpend(transactions, "Entertainment", range)).toBe(0);
    });

    it("handles an empty/missing transaction list", () => {
      expect(getCategorySpend(undefined, "Food & Groceries", range)).toBe(0);
    });
  });

  describe("getBudgetStatus", () => {
    it("returns 'ok' when there is no limit set", () => {
      expect(getBudgetStatus(50, 0)).toBe("ok");
      expect(getBudgetStatus(50, null)).toBe("ok");
      expect(getBudgetStatus(50, -10)).toBe("ok");
    });

    it("returns 'ok' below the 80% warning threshold", () => {
      expect(getBudgetStatus(79, 100)).toBe("ok");
    });

    it("returns 'warning' from 80% up to (but under) 100%", () => {
      expect(getBudgetStatus(80, 100)).toBe("warning");
      expect(getBudgetStatus(99, 100)).toBe("warning");
    });

    it("returns 'exceeded' at or above 100%", () => {
      expect(getBudgetStatus(100, 100)).toBe("exceeded");
      expect(getBudgetStatus(150, 100)).toBe("exceeded");
    });
  });

  describe("computeBudgetProgress", () => {
    const categoryBudgets = {
      key1: { name: "Food & Groceries", amount: 150 },
      key2: { name: "Transport", amount: 100 },
      key3: { name: "Entertainment", amount: 0 }, // no real budget, filtered out
      key4: { amount: 50 }, // missing name, filtered out
    };

    it("computes spend/limit/percent/status per category, sorted by usage", () => {
      const result = computeBudgetProgress(
        transactions,
        categoryBudgets,
        new Date(2026, 2, 15),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: "Food & Groceries",
        limit: 150,
        spend: 150,
        percent: 1,
        status: "exceeded",
      });
      expect(result[1]).toMatchObject({
        name: "Transport",
        limit: 100,
        spend: 30,
        percent: 0.3,
        status: "ok",
      });
    });

    it("returns an empty array when there are no budgets", () => {
      expect(computeBudgetProgress(transactions, {})).toEqual([]);
    });
  });

  describe("getEffectiveBudgetLimit (rollover)", () => {
    // February 2026: spent 40 of a 100 budget -> 60 unspent.
    const rolloverTx = [
      { id: "f1", type: "expense", category: "Transport", amount: 40, date: "2026-02-10" },
      // March: 30 spent so far.
      { id: "f2", type: "expense", category: "Transport", amount: 30, date: "2026-03-05" },
    ];
    const march = new Date(2026, 2, 15);

    it("returns the base limit unchanged when rollover is off", () => {
      const budget = { name: "Transport", amount: 100, rollover: false };
      expect(getEffectiveBudgetLimit(rolloverTx, budget, march)).toBe(100);
    });

    it("adds last month's unspent amount as credit when rollover is on", () => {
      const budget = { name: "Transport", amount: 100, rollover: true };
      // 100 - 40 spent last month = 60 credit -> 160 effective limit.
      expect(getEffectiveBudgetLimit(rolloverTx, budget, march)).toBe(160);
    });

    it("subtracts last month's overspend as debit when rollover is on", () => {
      const overspendTx = [
        { id: "o1", type: "expense", category: "Transport", amount: 130, date: "2026-02-10" },
      ];
      const budget = { name: "Transport", amount: 100, rollover: true };
      // 100 - 130 spent last month = -30 debit -> 70 effective limit.
      expect(getEffectiveBudgetLimit(overspendTx, budget, march)).toBe(70);
    });

    it("floors at a small positive amount rather than going to 0 or negative", () => {
      const bigOverspendTx = [
        { id: "o2", type: "expense", category: "Transport", amount: 500, date: "2026-02-10" },
      ];
      const budget = { name: "Transport", amount: 100, rollover: true };
      expect(getEffectiveBudgetLimit(bigOverspendTx, budget, march)).toBeCloseTo(0.01);
    });

    it("only looks one month back, using that month's base limit (no compounding)", () => {
      // Jan: 0 spent (full 100 credit). Feb: 40 spent (60 credit).
      // If March only looks at Feb's *base* limit, it should not also
      // inherit Jan's credit on top.
      const twoMonthsTx = [
        { id: "j1", type: "expense", category: "Transport", amount: 0, date: "2026-01-10" },
        { id: "f3", type: "expense", category: "Transport", amount: 40, date: "2026-02-10" },
      ];
      const budget = { name: "Transport", amount: 100, rollover: true };
      expect(getEffectiveBudgetLimit(twoMonthsTx, budget, march)).toBe(160);
    });
  });

  describe("computeBudgetProgress (rollover)", () => {
    it("includes rollover, baseLimit, and rolloverAmount fields", () => {
      const tx = [
        { id: "t1", type: "expense", category: "Transport", amount: 40, date: "2026-02-10" },
        { id: "t2", type: "expense", category: "Transport", amount: 30, date: "2026-03-05" },
      ];
      const categoryBudgets = {
        key1: { name: "Transport", amount: 100, rollover: true },
      };
      const [item] = computeBudgetProgress(tx, categoryBudgets, new Date(2026, 2, 15));
      expect(item).toMatchObject({
        name: "Transport",
        rollover: true,
        baseLimit: 100,
        limit: 160,
        rolloverAmount: 60,
        spend: 30,
      });
    });
  });

  describe("categoryBudgetKey", () => {
    it("produces a URL-safe, RTDB-safe key", () => {
      const key = categoryBudgetKey("Food & Groceries");
      expect(key).not.toMatch(/[.#$[\]/]/);
    });

    it("is deterministic for the same input", () => {
      expect(categoryBudgetKey("Health")).toBe(categoryBudgetKey("Health"));
    });

    it("produces different keys for different names", () => {
      expect(categoryBudgetKey("Health")).not.toBe(categoryBudgetKey("Travel"));
    });
  });

  describe("getNewlyCrossedThreshold", () => {
    it("returns null when there is no limit", () => {
      expect(getNewlyCrossedThreshold(0, 50, 0)).toBeNull();
    });

    it("returns null when still under 80% after the new amount", () => {
      expect(getNewlyCrossedThreshold(50, 10, 100)).toBeNull();
    });

    it("returns 'warning' when the new amount pushes spend from under to at/over 80%", () => {
      expect(getNewlyCrossedThreshold(70, 15, 100)).toBe("warning");
    });

    it("returns 'exceeded' when the new amount pushes spend from under to at/over 100%", () => {
      expect(getNewlyCrossedThreshold(90, 15, 100)).toBe("exceeded");
    });

    it("returns null if the threshold was already crossed before this transaction", () => {
      expect(getNewlyCrossedThreshold(85, 5, 100)).toBeNull(); // already past 80%
      expect(getNewlyCrossedThreshold(105, 5, 100)).toBeNull(); // already past 100%
    });
  });
});
