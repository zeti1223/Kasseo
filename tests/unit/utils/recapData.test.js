import { describe, it, expect } from "vitest";
import {
  getRecapYears,
  getDefaultRecapPeriod,
  filterByRecapPeriod,
  buildRecapStats,
} from "@/utils/recapData";

describe("recapData.js", () => {
  const transactions = [
    {
      id: "tx1",
      date: "2025-03-10",
      type: "deposit",
      amount: 100,
      paidBy: "user1",
    },
    {
      id: "tx2",
      date: "2025-03-15",
      type: "expense",
      category: "Food & Groceries",
      amount: 40,
      paidBy: "user1",
      description: "Groceries run",
    },
    {
      id: "tx3",
      date: "2026-01-05",
      type: "expense",
      category: "Transport",
      amount: 20,
      paidBy: "user2",
      description: "Bus pass",
    },
    {
      id: "tx4",
      date: "2026-01-20",
      type: "expense",
      category: "Food & Groceries",
      amount: 80,
      paidBy: "user2",
      description: "Big dinner",
    },
  ];

  it("collects distinct years, most recent first", () => {
    expect(getRecapYears(transactions)).toEqual([2026, 2025]);
  });

  it("returns 'all' when there is no data", () => {
    expect(getDefaultRecapPeriod([])).toBe("all");
  });

  it("filters transactions down to a given year", () => {
    const filtered = filterByRecapPeriod(transactions, "2026");
    expect(filtered.map((t) => t.id)).toEqual(["tx3", "tx4"]);
  });

  it("'all' period returns every transaction untouched", () => {
    expect(filterByRecapPeriod(transactions, "all")).toBe(transactions);
  });

  it("builds aggregate stats for a period", () => {
    const stats = buildRecapStats(filterByRecapPeriod(transactions, "2026"), {
      mode: "kitty",
      members: { user2: { nickname: "Sam" } },
    });

    expect(stats.hasData).toBe(true);
    expect(stats.transactionCount).toBe(2);
    expect(stats.expenseCount).toBe(2);
    expect(stats.totalSpent).toBe(100);
    expect(stats.totalDeposited).toBe(0);
    expect(stats.topCategory).toEqual({
      name: "Food & Groceries",
      amount: 80,
      percent: 80,
    });
    expect(stats.biggestExpense.id).toBe("tx4");
    expect(stats.topDepositor).toBeNull();
    expect(stats.topSpender).toEqual({
      uid: "user2",
      name: "Sam",
      amount: 100,
    });
  });

  it("reports no data for an empty transaction list", () => {
    const stats = buildRecapStats([]);
    expect(stats.hasData).toBe(false);
    expect(stats.topCategory).toBeNull();
    expect(stats.biggestExpense).toBeNull();
  });
});
