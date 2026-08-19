/**
 * Utilities for exporting group transactions and fund data
 */

function escapeCSVField(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Trigger download of a file in the browser
 */
export function downloadFile(content, filename, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get member display name by UID
 */
function getMemberName(uid, members = {}) {
  if (!uid) return "";
  return (
    members[uid]?.nickname ||
    members[uid]?.displayName ||
    members[uid]?.email ||
    uid
  );
}

/**
 * Filter transactions based on date range and type
 */
export function filterTransactions(transactions = [], { dateFilter = "all", startDate = "", endDate = "", typeFilter = "all" } = {}) {
  return transactions.filter((tx) => {
    // Type filter
    if (typeFilter !== "all" && tx.type !== typeFilter) {
      return false;
    }

    if (!tx.date) return true;
    const txDate = new Date(tx.date);

    // Date filter
    const now = new Date();
    if (dateFilter === "this_month") {
      if (txDate.getFullYear() !== now.getFullYear() || txDate.getMonth() !== now.getMonth()) {
        return false;
      }
    } else if (dateFilter === "last_month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      if (txDate.getFullYear() !== lastMonth.getFullYear() || txDate.getMonth() !== lastMonth.getMonth()) {
        return false;
      }
    } else if (dateFilter === "this_year") {
      if (txDate.getFullYear() !== now.getFullYear()) {
        return false;
      }
    } else if (dateFilter === "custom") {
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;
    }

    return true;
  });
}

/**
 * Export transactions to CSV
 */
export function exportTransactionsToCSV(group, transactions, members = {}) {
  const headers = [
    "Date",
    "Type",
    "Category",
    "Description",
    "Paid By",
    "Amount",
    "Currency",
    "Original Amount",
    "Original Currency",
    "Split Among",
    "Split Details",
    "Settlement To",
    "Receipt ID",
  ];

  const rows = transactions.map((tx) => {
    // Determine type label
    const typeLabel =
      tx.type === "expense"
        ? "Expense"
        : tx.type === "deposit"
          ? "Deposit"
          : tx.type === "settlement"
            ? "Settlement"
            : tx.type || "";

    // Split participants
    let splitAmongText = "";
    let splitDetailsText = "";
    if (tx.type === "expense") {
      const participants = tx.splitAmong?.length
        ? tx.splitAmong
        : Object.keys(members);
      splitAmongText = participants
        .map((uid) => getMemberName(uid, members))
        .join("; ");

      if (tx.splitType === "percent" && tx.splitShares) {
        splitDetailsText = Object.entries(tx.splitShares)
          .map(([uid, pct]) => `${getMemberName(uid, members)}: ${pct}%`)
          .join("; ");
      } else if (tx.splitOption) {
        splitDetailsText = tx.splitOption === "whole_group" ? "Whole group" : "Per product";
      }
    }

    const originalAmount = tx.originalAmount !== undefined && tx.originalAmount !== null ? Number(tx.originalAmount).toFixed(2) : "";
    const originalCurrency = tx.originalCurrency || "";
    const settlementTo = tx.type === "settlement" && tx.to ? getMemberName(tx.to, members) : "";

    return [
      tx.date || "",
      typeLabel,
      tx.category || "",
      tx.description || "",
      getMemberName(tx.paidBy, members),
      Number(tx.amount || 0).toFixed(2),
      tx.baseCurrency || group?.currency || "",
      originalAmount,
      originalCurrency,
      splitAmongText,
      splitDetailsText,
      settlementTo,
      tx.receiptId || "",
    ].map(escapeCSVField).join(",");
  });

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility with international characters
  const csvContent = "\uFEFF" + [headers.map(escapeCSVField).join(","), ...rows].join("\r\n");
  const sanitizedGroupName = (group?.name || "fund").replace(/[^a-zA-Z0-9_-]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${sanitizedGroupName}_transactions_${today}.csv`;

  downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
}

/**
 * Export full group data and transactions to JSON
 */
export function exportGroupToJSON(group, transactions, members = {}, categories = []) {
  const memberList = Object.entries(members).map(([id, m]) => ({
    id,
    displayName: m.nickname || m.displayName || "",
    email: m.email || "",
    role: m.role || "member",
  }));

  const exportPayload = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    group: {
      id: group?.id || "",
      name: group?.name || "",
      currency: group?.currency || "",
      mode: group?.mode || "kitty",
      ownerId: group?.ownerId || "",
    },
    members: memberList,
    categories: categories || [],
    transactions: transactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      category: tx.category,
      categoryIcon: tx.categoryIcon || null,
      description: tx.description || "",
      amount: tx.amount,
      paidBy: {
        id: tx.paidBy,
        name: getMemberName(tx.paidBy, members),
      },
      baseCurrency: tx.baseCurrency || group?.currency,
      originalAmount: tx.originalAmount,
      originalCurrency: tx.originalCurrency,
      convertedAt: tx.convertedAt,
      splitAmong: tx.splitAmong,
      splitType: tx.splitType,
      splitShares: tx.splitShares,
      splitOption: tx.splitOption,
      to: tx.to ? { id: tx.to, name: getMemberName(tx.to, members) } : null,
      receiptId: tx.receiptId || null,
    })),
  };

  const jsonContent = JSON.stringify(exportPayload, null, 2);
  const sanitizedGroupName = (group?.name || "fund").replace(/[^a-zA-Z0-9_-]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${sanitizedGroupName}_backup_${today}.json`;

  downloadFile(jsonContent, filename, "application/json;charset=utf-8;");
}
