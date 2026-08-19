import { areaGradient } from "./chartTheme";

const PALETTE = [
  "#C8A5FC",
  "#A5E3FC",
  "#A7F49D",
  "#D89B3C",
  "#C1503A",
  "#8A5FBF",
  "#7A6248",
  "#5C7A99",
];

export function buildBalanceOverTime(transactions) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  let balance = 0;
  const labels = [];
  const data = [];
  for (const tx of sorted) {
    balance += tx.type === "deposit" ? tx.amount : -tx.amount;
    labels.push(tx.date);
    data.push(Number(balance.toFixed(2)));
  }
  return {
    labels,
    datasets: [
      {
        label: "Balance",
        data,
        borderColor: "#C8A5FC",
        backgroundColor: (ctx) =>
          areaGradient(ctx.chart.ctx, ctx.chart.chartArea, "#C8A5FC"),
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };
}

export function buildCategoryBreakdown(transactions) {
  const totals = {};
  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
  const labels = Object.keys(totals);
  return {
    labels,
    datasets: [
      {
        data: Object.values(totals),
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 0,
      },
    ],
  };
}

// Split mode: net balance per member (positive = owed money, negative =
// owes money). A net position, not a pairwise ledger.
export function computeSplitBalances(transactions, members) {
  const memberIds = Object.keys(members || {});
  const balances = {};
  memberIds.forEach((id) => (balances[id] = 0));

  transactions.forEach((tx) => applySplitTransaction(balances, tx, memberIds));

  return balances;
}

// Same as computeSplitBalances, but tracks one member's running total
// over time for a line chart.
export function buildYourBalanceOverTime(transactions, members, userId) {
  const memberIds = Object.keys(members || {});
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  const balances = {};
  memberIds.forEach((id) => (balances[id] = 0));

  const labels = [];
  const data = [];
  for (const tx of sorted) {
    applySplitTransaction(balances, tx, memberIds);
    labels.push(tx.date);
    data.push(Number((balances[userId] || 0).toFixed(2)));
  }

  return {
    labels,
    datasets: [
      {
        label: "Your balance",
        data,
        borderColor: "#C8A5FC",
        backgroundColor: (ctx) =>
          areaGradient(ctx.chart.ctx, ctx.chart.chartArea, "#C8A5FC"),
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };
}

// A participant's share of a split-mode expense: even by default, or
// by `splitShares` percentage when `splitType` is "percent".
export function splitShareAmount(tx, participantId, participants) {
  if (tx.splitType === "percent" && tx.splitShares) {
    const pct = Number(tx.splitShares[participantId] || 0);
    return (tx.amount * pct) / 100;
  }
  return tx.amount / participants.length;
}

function applySplitTransaction(balances, tx, memberIds) {
  if (tx.type === "expense") {
    const participants = (
      tx.splitAmong?.length ? tx.splitAmong : memberIds
    ).filter((id) => id in balances);
    if (!participants.length) return;
    participants.forEach((id) => {
      balances[id] -= splitShareAmount(tx, id, participants);
    });
    if (tx.paidBy in balances) {
      balances[tx.paidBy] += tx.amount;
    }
  } else if (tx.type === "settlement") {
    // tx.paidBy settled their debt by paying tx.to directly.
    if (tx.paidBy in balances) balances[tx.paidBy] += tx.amount;
    if (tx.to in balances) balances[tx.to] -= tx.amount;
  }
}

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

// Every month between the first and last transaction, so inactive
// months show as a zero bar instead of being skipped.
function monthRange(transactions) {
  if (!transactions.length) return [];
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  const start = new Date(sorted[0].date);
  const end = new Date(sorted[sorted.length - 1].date);
  const keys = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    keys.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

// Deposits vs. expenses per month. Settlements are excluded — they move
// money between members without changing the fund's overall total.
export function buildMonthlyCashFlow(transactions) {
  const months = monthRange(transactions);
  const deposited = Object.fromEntries(months.map((m) => [m, 0]));
  const spent = Object.fromEntries(months.map((m) => [m, 0]));

  transactions.forEach((tx) => {
    const key = monthKey(tx.date);
    if (!(key in deposited)) return;
    if (tx.type === "deposit") deposited[key] += tx.amount;
    else if (tx.type === "expense") spent[key] += tx.amount;
  });

  return {
    labels: months.map(monthLabel),
    datasets: [
      {
        label: "Deposited",
        data: months.map((m) => Number(deposited[m].toFixed(2))),
        backgroundColor: "#A7F49D",
        borderRadius: 4,
        maxBarThickness: 28,
      },
      {
        label: "Spent",
        data: months.map((m) => Number(spent[m].toFixed(2))),
        backgroundColor: "#C1503A",
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  };
}

// Stacked per-category spending by month.
export function buildCategoryTrend(transactions) {
  const months = monthRange(transactions);
  const expenses = transactions.filter((t) => t.type === "expense");
  const categories = [...new Set(expenses.map((t) => t.category))];

  const totalsByCategory = Object.fromEntries(
    categories.map((c) => [c, Object.fromEntries(months.map((m) => [m, 0]))]),
  );
  expenses.forEach((tx) => {
    const key = monthKey(tx.date);
    if (totalsByCategory[tx.category] && key in totalsByCategory[tx.category]) {
      totalsByCategory[tx.category][key] += tx.amount;
    }
  });

  return {
    labels: months.map(monthLabel),
    datasets: categories.map((category, i) => ({
      label: category,
      data: months.map((m) => Number(totalsByCategory[category][m].toFixed(2))),
      backgroundColor: PALETTE[i % PALETTE.length],
      borderRadius: 3,
      maxBarThickness: 28,
    })),
  };
}

// Split mode: every member's net balance over time, one line each.
export function buildAllMembersBalanceOverTime(transactions, members) {
  const memberIds = Object.keys(members || {});
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  const balances = {};
  memberIds.forEach((id) => (balances[id] = 0));

  const labels = [];
  const series = Object.fromEntries(memberIds.map((id) => [id, []]));
  for (const tx of sorted) {
    applySplitTransaction(balances, tx, memberIds);
    labels.push(tx.date);
    memberIds.forEach((id) =>
      series[id].push(Number((balances[id] || 0).toFixed(2))),
    );
  }

  return {
    labels,
    datasets: memberIds.map((id, i) => ({
      label:
        members[id]?.nickname || members[id]?.displayName || "Someone",
      data: series[id],
      borderColor: PALETTE[i % PALETTE.length],
      backgroundColor: PALETTE[i % PALETTE.length],
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 4,
      fill: false,
    })),
  };
}

export function buildMemberBreakdown(transactions, members) {
  const memberIds = Object.keys(members || {});
  const deposited = memberIds.map((uid) =>
    transactions
      .filter((t) => t.paidBy === uid && t.type === "deposit")
      .reduce((s, t) => s + t.amount, 0),
  );
  const spent = memberIds.map((uid) =>
    transactions
      .filter((t) => t.paidBy === uid && t.type === "expense")
      .reduce((s, t) => s + t.amount, 0),
  );
  return {
    labels: memberIds.map(
      (uid) => members[uid]?.nickname || members[uid]?.displayName || "Someone",
    ),
    datasets: [
      {
        label: "Deposited",
        data: deposited,
        backgroundColor: "#A7F49D",
        borderRadius: 4,
        maxBarThickness: 28,
      },
      {
        label: "Spent",
        data: spent,
        backgroundColor: "#C1503A",
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  };
}
