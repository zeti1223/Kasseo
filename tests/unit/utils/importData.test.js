import { describe, it, expect } from "vitest";
import {
  parseCSV,
  normalizeDate,
  parseAmount,
  normalizeCurrency,
  normalizeCategory,
  detectImportFormat,
  parseSplitwiseCSV,
  parseSplitalCSV,
  parseKasseoCSV,
  parseJSONData,
  parseImportFile,
  generateDefaultMemberMapping,
} from "@/utils/importData";

describe("importData.js", () => {
  describe("normalizeDate", () => {
    it("handles ISO YYYY-MM-DD", () => {
      expect(normalizeDate("2026-05-12")).toBe("2026-05-12");
      expect(normalizeDate("2026/05/12 14:30:00")).toBe("2026-05-12");
    });

    it("handles DD/MM/YYYY and DD-MM-YYYY", () => {
      expect(normalizeDate("15/04/2026")).toBe("2026-04-15");
      expect(normalizeDate("05-11-2025")).toBe("2025-11-05");
    });

    it("handles fallback to today when empty", () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(normalizeDate("")).toBe(today);
    });
  });

  describe("parseAmount", () => {
    it("parses regular float strings and numbers", () => {
      expect(parseAmount("45.50")).toBe(45.5);
      expect(parseAmount(120.99)).toBe(120.99);
    });

    it("handles currency symbols and spaces", () => {
      expect(parseAmount("$ 150.00")).toBe(150);
      expect(parseAmount("€ 99,50")).toBe(99.5);
      expect(parseAmount("1 250,50 Ft")).toBe(1250.5);
    });

    it("handles thousand separators", () => {
      expect(parseAmount("1,234.56")).toBe(1234.56);
      expect(parseAmount("1.234,56")).toBe(1234.56);
    });
  });

  describe("normalizeCurrency", () => {
    it("normalizes symbols to ISO codes", () => {
      expect(normalizeCurrency("$")).toBe("USD");
      expect(normalizeCurrency("€")).toBe("EUR");
      expect(normalizeCurrency("£")).toBe("GBP");
      expect(normalizeCurrency("Ft")).toBe("HUF");
    });

    it("handles valid ISO codes and clean strings", () => {
      expect(normalizeCurrency("EUR")).toBe("EUR");
      expect(normalizeCurrency("HUF")).toBe("HUF");
      expect(normalizeCurrency("usd")).toBe("USD");
    });
  });

  describe("normalizeCategory", () => {
    it("maps Splitwise and common categories to Kasseo standard categories", () => {
      expect(normalizeCategory("Food and drink")).toBe("Food & Groceries");
      expect(normalizeCategory("Groceries")).toBe("Food & Groceries");
      expect(normalizeCategory("Dining Out")).toBe("Food & Groceries");
      expect(normalizeCategory("Rent")).toBe("Rent & Utilities");
      expect(normalizeCategory("Electricity")).toBe("Rent & Utilities");
      expect(normalizeCategory("Taxi")).toBe("Transport");
      expect(normalizeCategory("Gas/fuel")).toBe("Transport");
      expect(normalizeCategory("Games")).toBe("Entertainment");
      expect(normalizeCategory("Movies")).toBe("Entertainment");
      expect(normalizeCategory("Clothing")).toBe("Shopping");
      expect(normalizeCategory("Pharmacy")).toBe("Health");
      expect(normalizeCategory("Hotel")).toBe("Travel");
      expect(normalizeCategory("General")).toBe("Other");
    });
  });

  describe("parseCSV", () => {
    it("parses standard CSV with commas", () => {
      const csv = "Date,Description,Cost\n2026-01-01,Groceries,45.50\n2026-01-02,Dinner,60.00";
      const { headers, rows } = parseCSV(csv);
      expect(headers).toEqual(["Date", "Description", "Cost"]);
      expect(rows).toHaveLength(2);
      expect(rows[0]["Description"]).toBe("Groceries");
    });

    it("handles semicolon delimiters and quotes with commas", () => {
      const csv = 'Date;Description;Cost\n2026-01-01;"Milk, Bread & Eggs";15.00';
      const { headers, rows } = parseCSV(csv);
      expect(headers).toEqual(["Date", "Description", "Cost"]);
      expect(rows[0]["Description"]).toBe("Milk, Bread & Eggs");
    });

    it("handles escaped quotes and newlines within quoted fields", () => {
      const csv = 'Date,Description,Cost\n2026-01-01,"Line 1\nLine 2 ""quoted""",25.00';
      const { rows } = parseCSV(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]["Description"]).toContain('Line 2 "quoted"');
    });

    it("strips UTF-8 BOM", () => {
      const csv = "\uFEFFDate,Cost\n2026-01-01,10";
      const { headers } = parseCSV(csv);
      expect(headers[0]).toBe("Date");
    });
  });

  describe("Splitwise CSV Parser", () => {
    const splitwiseCSV = `Date,Description,Category,Cost,Currency,Alice,Bob,Charlie
2026-05-01,Supermarket,Groceries,90.00,USD,60.00,-30.00,-30.00
2026-05-02,Taxi,Transportation,30.00,USD,-15.00,15.00,0.00
2026-05-03,Bob paid Alice,Payment,20.00,USD,-20.00,20.00,0.00`;

    it("detects Splitwise format correctly", () => {
      const detection = detectImportFormat(splitwiseCSV, "splitwise_group.csv");
      expect(detection.format).toBe("splitwise_csv");
    });

    it("parses expenses and settlements accurately", () => {
      const { transactions, members, defaultCurrency } = parseImportFile(splitwiseCSV, "Trip.csv");
      expect(defaultCurrency).toBe("USD");
      expect(members).toContain("Alice");
      expect(members).toContain("Bob");
      expect(members).toContain("Charlie");
      expect(transactions).toHaveLength(3);

      // 1. Supermarket expense: Alice paid $90, split with Bob & Charlie ($30 each)
      const tx1 = transactions[0];
      expect(tx1.type).toBe("expense");
      expect(tx1.category).toBe("Food & Groceries");
      expect(tx1.amount).toBe(90);
      expect(tx1.paidByName).toBe("Alice");
      expect(tx1.splitAmongNames).toEqual(expect.arrayContaining(["Alice", "Bob", "Charlie"]));

      // 2. Taxi expense: Bob paid $30, split with Alice ($15 each)
      const tx2 = transactions[1];
      expect(tx2.type).toBe("expense");
      expect(tx2.paidByName).toBe("Bob");
      expect(tx2.splitAmongNames).toEqual(expect.arrayContaining(["Alice", "Bob"]));

      // 3. Payment settlement: Bob paid Alice $20
      const tx3 = transactions[2];
      expect(tx3.type).toBe("settlement");
      expect(tx3.amount).toBe(20);
      expect(tx3.paidByName).toBe("Bob");
      expect(tx3.toName).toBe("Alice");
    });
  });

  describe("Splital CSV Parser", () => {
    const splitalCSV = `Date,Title,Category,Amount,Currency,Paid by,Split with
2026-06-01,Hotel,Accommodation,300.00,EUR,David,David; Emma; Frank
2026-06-02,Emma to David,Settlement,100.00,EUR,Emma,David`;

    it("parses Splital format accurately", () => {
      const { transactions, members, defaultCurrency } = parseImportFile(splitalCSV, "Vacation.csv");
      expect(defaultCurrency).toBe("EUR");
      expect(members).toContain("David");
      expect(members).toContain("Emma");
      expect(members).toContain("Frank");

      expect(transactions[0].type).toBe("expense");
      expect(transactions[0].category).toBe("Travel");
      expect(transactions[0].paidByName).toBe("David");
      expect(transactions[0].splitAmongNames).toEqual(["David", "Emma", "Frank"]);

      expect(transactions[1].type).toBe("settlement");
      expect(transactions[1].paidByName).toBe("Emma");
      expect(transactions[1].toName).toBe("David");
    });
  });

  describe("Kasseo JSON Parser", () => {
    const kasseoBackup = {
      version: "1.0",
      group: {
        id: "grp123",
        name: "Flatmates",
        currency: "GBP",
        mode: "split",
      },
      members: [
        { id: "u1", displayName: "Harry" },
        { id: "u2", displayName: "Ron" },
      ],
      categories: ["Rent"],
      transactions: [
        {
          id: "tx1",
          date: "2026-07-01",
          type: "expense",
          category: "Rent & Utilities",
          amount: 500,
          baseCurrency: "GBP",
          paidBy: { id: "u1", name: "Harry" },
          splitAmong: ["u1", "u2"],
        },
      ],
    };

    it("parses Kasseo JSON backup payload", () => {
      const jsonStr = JSON.stringify(kasseoBackup);
      const parsed = parseImportFile(jsonStr, "Flatmates_backup.json");
      expect(parsed.groupName).toBe("Flatmates backup");
      expect(parsed.defaultCurrency).toBe("GBP");
      expect(parsed.members).toContain("Harry");
      expect(parsed.members).toContain("Ron");
      expect(parsed.transactions).toHaveLength(1);
      expect(parsed.transactions[0].paidByName).toBe("Harry");
      expect(parsed.transactions[0].splitAmongNames).toEqual(["Harry", "Ron"]);
    });
  });

  describe("Kasseo CSV Parser", () => {
    const kasseoCSV = `Date,Type,Category,Description,Paid By,Amount,Currency,Original Amount,Original Currency,Split Among,Split Details,Settlement To,Receipt ID
2026-08-01,Expense,Food & Groceries,Groceries,Alice,100.00,USD,100.00,USD,Alice; Bob,Alice: 60%; Bob: 40%,,
2026-08-02,Settlement,Settlement,Settling,Bob,40.00,USD,40.00,USD,,,Alice,`;

    it("parses Kasseo CSV export format", () => {
      const { transactions, members, defaultCurrency } = parseImportFile(kasseoCSV, "Kasseo_backup.csv");
      expect(defaultCurrency).toBe("USD");
      expect(members).toEqual(expect.arrayContaining(["Alice", "Bob"]));
      expect(transactions).toHaveLength(2);

      const tx1 = transactions[0];
      expect(tx1.type).toBe("expense");
      expect(tx1.category).toBe("Food & Groceries");
      expect(tx1.amount).toBe(100);
      expect(tx1.paidByName).toBe("Alice");
      expect(tx1.splitType).toBe("percent");
      expect(tx1.splitShares).toEqual({ Alice: 60, Bob: 40 });

      const tx2 = transactions[1];
      expect(tx2.type).toBe("settlement");
      expect(tx2.amount).toBe(40);
      expect(tx2.paidByName).toBe("Bob");
      expect(tx2.toName).toBe("Alice");
    });
  });

  describe("Splitwise Unequal Split Parser", () => {
    const splitwiseUnequal = `Date,Description,Category,Cost,Currency,Alice,Bob
2026-08-05,Dinner,Dining Out,100.00,USD,70.00,-70.00`;

    it("parses unequal split shares correctly as percent", () => {
      const { transactions } = parseImportFile(splitwiseUnequal, "Dinner.csv");
      expect(transactions).toHaveLength(1);
      const tx = transactions[0];
      expect(tx.type).toBe("expense");
      expect(tx.splitType).toBe("percent");
      expect(tx.splitShares).toEqual({ Alice: 30, Bob: 70 });
    });
  });

  describe("generateDefaultMemberMapping", () => {
    it("matches member names case-insensitively", () => {
      const sourceNames = ["Alice Smith", "Bob", "Charlie"];
      const existingMembers = {
        uid1: { displayName: "Alice Smith" },
        uid2: { nickname: "bob" },
      };

      const mapping = generateDefaultMemberMapping(sourceNames, existingMembers);
      expect(mapping["Alice Smith"]).toBe("uid1");
      expect(mapping["Bob"]).toBe("uid2");
      expect(mapping["Charlie"]).toBeNull();
    });
  });
});
