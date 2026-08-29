import { describe, it, expect } from "vitest";
import {
  buildBalanceOverTime,
  buildCategoryBreakdown,
  computeSplitBalances,
  simplifyDebts,
  buildYourBalanceOverTime,
  splitShareAmount,
  buildMonthlyCashFlow,
  buildCategoryTrend,
  buildAllMembersBalanceOverTime,
  buildMemberBreakdown,
} from "@/utils/chartData";

describe("chartData.js", () => {
  const mockTransactions = [
    {
      id: "tx1",
      date: "2026-01-10",
      type: "deposit",
      amount: 100,
      paidBy: "user1",
    },
    {
      id: "tx2",
      date: "2026-01-15",
      type: "expense",
      category: "Food & Groceries",
      amount: 40,
      paidBy: "user1",
      splitAmong: ["user1", "user2"],
    },
    {
      id: "tx3",
      date: "2026-02-05",
      type: "expense",
      category: "Transport",
      amount: 20,
      paidBy: "user2",
      splitAmong: ["user1", "user2"],
    },
  ];

  const mockMembers = {
    user1: { nickname: "Alice", displayName: "Alice Smith" },
    user2: { nickname: "Bob", displayName: "Bob Jones" },
  };

  describe("buildBalanceOverTime", () => {
    it("computes cumulative running balance", () => {
      const result = buildBalanceOverTime(mockTransactions);
      expect(result.labels).toEqual(["2026-01-10", "2026-01-15", "2026-02-05"]);
      // 100 - 40 - 20 = 40
      expect(result.datasets[0].data).toEqual([100, 60, 40]);
    });

    it("handles empty transactions", () => {
      const result = buildBalanceOverTime([]);
      expect(result.labels).toEqual([]);
      expect(result.datasets[0].data).toEqual([]);
    });
  });

  describe("buildCategoryBreakdown", () => {
    it("aggregates expenses by category", () => {
      const result = buildCategoryBreakdown(mockTransactions);
      expect(result.labels.length).toBe(2);
      expect(result.datasets[0].data).toEqual([40, 20]);
    });
  });

  describe("splitShareAmount", () => {
    it("calculates equal split shares by default", () => {
      const tx = { amount: 60 };
      const share = splitShareAmount(tx, "u1", ["u1", "u2", "u3"]);
      expect(share).toBe(20);
    });

    it("calculates percentage split shares when splitType is percent", () => {
      const tx = {
        amount: 100,
        splitType: "percent",
        splitShares: { u1: 30, u2: 70 },
      };
      expect(splitShareAmount(tx, "u1", ["u1", "u2"])).toBe(30);
      expect(splitShareAmount(tx, "u2", ["u1", "u2"])).toBe(70);
    });
  });

  describe("computeSplitBalances", () => {
    it("computes net balances for all members", () => {
      const balances = computeSplitBalances(mockTransactions, mockMembers);
      // tx2: Alice paid 40 for Alice & Bob -> Alice +20, Bob -20
      // tx3: Bob paid 20 for Alice & Bob -> Bob +10, Alice -10
      // Total net: Alice +10, Bob -10
      expect(balances.user1).toBe(10);
      expect(balances.user2).toBe(-10);
    });

    it("handles settlement transactions", () => {
      const txs = [
        ...mockTransactions,
        {
          id: "tx4",
          date: "2026-02-10",
          type: "settlement",
          amount: 10,
          paidBy: "user2",
          to: "user1",
        },
      ];
      const balances = computeSplitBalances(txs, mockMembers);
      expect(balances.user1).toBe(0);
      expect(balances.user2).toBe(0);
    });
  });

  describe("simplifyDebts", () => {
    it("simplifies net balances into minimum settlements", () => {
      const balances = {
        u1: -20,
        u2: -30,
        u3: 50,
      };
      const settlements = simplifyDebts(balances);
      expect(settlements).toEqual([
        { from: "u2", to: "u3", amount: 30 },
        { from: "u1", to: "u3", amount: 20 },
      ]);
    });

    it("returns empty array if balances are already 0", () => {
      const settlements = simplifyDebts({ u1: 0, u2: 0 });
      expect(settlements).toEqual([]);
    });
  });

  describe("buildYourBalanceOverTime", () => {
    it("tracks a specific user's balance progression over time", () => {
      const result = buildYourBalanceOverTime(mockTransactions, mockMembers, "user1");
      expect(result.labels).toEqual(["2026-01-10", "2026-01-15", "2026-02-05"]);
      // tx1: deposit (not split expense) -> user1=0
      // tx2: Alice pays 40 for both -> user1=+20
      // tx3: Bob pays 20 for both -> user1=+10
      expect(result.datasets[0].data).toEqual([0, 20, 10]);
    });
  });

  describe("buildMonthlyCashFlow", () => {
    it("aggregates deposited and spent per month", () => {
      const result = buildMonthlyCashFlow(mockTransactions);
      expect(result.labels.length).toBe(2); // Jan and Feb
      expect(result.datasets[0].label).toBeDefined(); // Deposited
      expect(result.datasets[1].label).toBeDefined(); // Spent
      expect(result.datasets[0].data).toEqual([100, 0]);
      expect(result.datasets[1].data).toEqual([40, 20]);
    });
  });

  describe("buildCategoryTrend", () => {
    it("generates stacked trend by category and month", () => {
      const result = buildCategoryTrend(mockTransactions);
      expect(result.labels.length).toBe(2);
      expect(result.datasets.length).toBe(2); // Food & Groceries, Transport
    });
  });

  describe("buildAllMembersBalanceOverTime", () => {
    it("generates time series dataset for every member", () => {
      const result = buildAllMembersBalanceOverTime(mockTransactions, mockMembers);
      expect(result.datasets.length).toBe(2);
      expect(result.datasets[0].label).toBe("Alice");
      expect(result.datasets[1].label).toBe("Bob");
    });
  });

  describe("buildMemberBreakdown", () => {
    it("breaks down total deposits and expenses per member", () => {
      const result = buildMemberBreakdown(mockTransactions, mockMembers);
      expect(result.labels).toEqual(["Alice", "Bob"]);
      expect(result.datasets[0].data).toEqual([100, 0]); // Deposited
      expect(result.datasets[1].data).toEqual([40, 20]); // Spent
    });
  });
});
