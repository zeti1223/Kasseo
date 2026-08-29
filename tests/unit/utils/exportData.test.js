import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  filterTransactions,
  exportTransactionsToCSV,
  exportGroupToJSON,
  downloadFile,
} from "@/utils/exportData";

describe("exportData.js", () => {
  const transactions = [
    {
      id: "tx1",
      date: "2026-01-10",
      type: "expense",
      category: "Food",
      description: "Lunch",
      amount: 15,
      paidBy: "u1",
      splitAmong: ["u1", "u2"],
    },
    {
      id: "tx2",
      date: "2026-01-15",
      type: "deposit",
      category: "Income",
      description: "Deposit",
      amount: 50,
      paidBy: "u2",
    },
  ];

  const group = {
    id: "g1",
    name: "Trip Fund",
    currency: "EUR",
    mode: "kitty",
    ownerId: "u1",
  };

  const members = {
    u1: { nickname: "Alice", email: "alice@test.com" },
    u2: { nickname: "Bob", email: "bob@test.com" },
  };

  describe("filterTransactions", () => {
    it("returns all transactions when default filters applied", () => {
      expect(filterTransactions(transactions)).toHaveLength(2);
    });

    it("filters by transaction type", () => {
      const expenseOnly = filterTransactions(transactions, { typeFilter: "expense" });
      expect(expenseOnly).toHaveLength(1);
      expect(expenseOnly[0].id).toBe("tx1");

      const depositOnly = filterTransactions(transactions, { typeFilter: "deposit" });
      expect(depositOnly).toHaveLength(1);
      expect(depositOnly[0].id).toBe("tx2");
    });

    it("filters by custom date range", () => {
      const filtered = filterTransactions(transactions, {
        dateFilter: "custom",
        startDate: "2026-01-12",
        endDate: "2026-01-20",
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("tx2");
    });
  });

  describe("downloadFile", () => {
    it("creates blob url and triggers link click", () => {
      const createElementSpy = vi.spyOn(document, "createElement");
      const appendChildSpy = vi.spyOn(document.body, "appendChild");
      const removeChildSpy = vi.spyOn(document.body, "removeChild");

      downloadFile("test content", "test.txt");

      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });

  describe("exportTransactionsToCSV", () => {
    it("triggers CSV download with proper content and headers", () => {
      let createdBlobContent = "";
      const origBlob = globalThis.Blob;
      globalThis.Blob = class extends origBlob {
        constructor(parts, options) {
          super(parts, options);
          createdBlobContent = parts.join("");
        }
      };

      exportTransactionsToCSV(group, transactions, members);

      expect(createdBlobContent).toContain("Date,Type,Category,Description");
      expect(createdBlobContent).toContain("Lunch");
      expect(createdBlobContent).toContain("Alice");

      globalThis.Blob = origBlob;
    });
  });

  describe("exportGroupToJSON", () => {
    it("triggers JSON download with full group backup payload", () => {
      let createdBlobContent = "";
      const origBlob = globalThis.Blob;
      globalThis.Blob = class extends origBlob {
        constructor(parts, options) {
          super(parts, options);
          createdBlobContent = parts.join("");
        }
      };

      exportGroupToJSON(group, transactions, members, ["Food", "Income"]);

      const parsed = JSON.parse(createdBlobContent);
      expect(parsed.version).toBe("1.0");
      expect(parsed.group.name).toBe("Trip Fund");
      expect(parsed.members).toHaveLength(2);
      expect(parsed.transactions).toHaveLength(2);
      expect(parsed.categories).toEqual(["Food", "Income"]);

      globalThis.Blob = origBlob;
    });
  });
});
