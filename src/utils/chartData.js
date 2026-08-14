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
        backgroundColor: "rgba(200, 165, 252, 0.12)",
        fill: true,
        tension: 0.3,
        pointRadius: 2,
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

// Split mode: net balance per member across every expense + settlement.
// Positive = the group owes this member money. Negative = this member
// owes the group money. This is a net position, not a pairwise ledger,
// so with more than two members it answers "am I owed / do I owe
// overall", not "who exactly owes whom" — settling up is still done
// directly between two chosen members.
export function computeSplitBalances(transactions, members) {
  const memberIds = Object.keys(members || {});
  const balances = {};
  memberIds.forEach((id) => (balances[id] = 0));

  transactions.forEach((tx) => applySplitTransaction(balances, tx, memberIds));

  return balances;
}

// Same math as computeSplitBalances, but only tracks the running total
// for a single member, in date order, for a "your balance over time"
// line chart.
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
        backgroundColor: "rgba(200, 165, 252, 0.12)",
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  };
}

function applySplitTransaction(balances, tx, memberIds) {
  if (tx.type === "expense") {
    const participants = (
      tx.splitAmong?.length ? tx.splitAmong : memberIds
    ).filter((id) => id in balances);
    if (!participants.length) return;
    const share = tx.amount / participants.length;
    participants.forEach((id) => {
      balances[id] -= share;
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
    labels: memberIds.map((uid) => members[uid]?.displayName || "Someone"),
    datasets: [
      { label: "Deposited", data: deposited, backgroundColor: "#A7F49D" },
      { label: "Spent", data: spent, backgroundColor: "#C1503A" },
    ],
  };
}
