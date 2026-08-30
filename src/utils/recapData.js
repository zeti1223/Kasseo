/**
 * Utilities for building a "Wrapped"-style periodic spending recap out of
 * a fund's transactions: period selection + aggregated highlight stats.
 */

/**
 * Every distinct year that has at least one transaction, most recent first.
 * @param {Array} transactions
 * @returns {number[]}
 */
export function getRecapYears(transactions = []) {
  const years = new Set();
  transactions.forEach((t) => {
    if (!t.date) return;
    const y = new Date(t.date).getFullYear();
    if (!Number.isNaN(y)) years.add(y);
  });
  return [...years].sort((a, b) => b - a);
}

/**
 * A sensible default period: the current year if it already has data,
 * otherwise the most recent year that does, otherwise "all".
 * @param {Array} transactions
 * @returns {string} "all" or a stringified year
 */
export function getDefaultRecapPeriod(transactions = []) {
  const years = getRecapYears(transactions);
  if (!years.length) return "all";
  const currentYear = new Date().getFullYear();
  return String(years.includes(currentYear) ? currentYear : years[0]);
}

/**
 * Filters transactions down to a period. `period` is either "all" or a
 * stringified/numeric year.
 * @param {Array} transactions
 * @param {string|number} period
 * @returns {Array}
 */
export function filterByRecapPeriod(transactions = [], period = "all") {
  if (period === "all" || period == null) return transactions;
  const year = Number(period);
  if (Number.isNaN(year)) return transactions;
  return transactions.filter(
    (t) => t.date && new Date(t.date).getFullYear() === year,
  );
}

function memberName(uid, members = {}) {
  if (!uid) return null;
  return (
    members[uid]?.nickname ||
    members[uid]?.displayName ||
    members[uid]?.email ||
    null
  );
}

function topEntry(totals) {
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries[0] : null;
}

/**
 * Aggregates a period's transactions into the highlight stats a recap
 * card deck is built from. Any stat without enough underlying data comes
 * back as `null` so the UI can skip that slide.
 *
 * @param {Array} transactions - already filtered to the desired period
 * @param {Object} [opts]
 * @param {"kitty"|"split"} [opts.mode]
 * @param {Object} [opts.members]
 * @returns {Object}
 */
export function buildRecapStats(transactions = [], opts = {}) {
  const { mode = "kitty", members = {} } = opts;

  const expenses = transactions.filter((t) => t.type === "expense");
  const deposits = transactions.filter((t) => t.type === "deposit");

  const totalSpent = expenses.reduce((s, t) => s + (t.amount || 0), 0);
  const totalDeposited = deposits.reduce((s, t) => s + (t.amount || 0), 0);

  const categoryTotals = {};
  expenses.forEach((t) => {
    if (!t.category) return;
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });
  const topCategoryEntry = topEntry(categoryTotals);
  const topCategory = topCategoryEntry
    ? {
        name: topCategoryEntry[0],
        amount: topCategoryEntry[1],
        percent: totalSpent ? (topCategoryEntry[1] / totalSpent) * 100 : 0,
      }
    : null;

  // Top categories (for the mini donut/legend visual on the topCategory
  // card) — independent of `topCategory` above so its shape never changes.
  const categoryBreakdown = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({
      name,
      amount,
      percent: totalSpent ? (amount / totalSpent) * 100 : 0,
    }));

  const biggestExpense =
    [...expenses].sort((a, b) => b.amount - a.amount)[0] || null;

  const monthTotals = {};
  expenses.forEach((t) => {
    if (!t.date) return;
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthTotals[key] = (monthTotals[key] || 0) + t.amount;
  });
  const topMonthEntry = topEntry(monthTotals);
  const topMonth = topMonthEntry
    ? {
        date: new Date(
          Number(topMonthEntry[0].split("-")[0]),
          Number(topMonthEntry[0].split("-")[1]),
          1,
        ),
        amount: topMonthEntry[1],
      }
    : null;

  // Last up-to-6 months chronologically (for the mini sparkline visual on
  // the topMonth card) — independent of `topMonth` above.
  const monthlyTrend = Object.entries(monthTotals)
    .sort((a, b) => {
      const [ay, am] = a[0].split("-").map(Number);
      const [by, bm] = b[0].split("-").map(Number);
      return ay === by ? am - bm : ay - by;
    })
    .slice(-6)
    .map(([key, amount]) => {
      const [y, m] = key.split("-").map(Number);
      return { date: new Date(y, m, 1), amount };
    });

  const spentByMember = {};
  expenses.forEach((t) => {
    if (!t.paidBy) return;
    spentByMember[t.paidBy] = (spentByMember[t.paidBy] || 0) + t.amount;
  });
  const topSpenderEntry = topEntry(spentByMember);
  const topSpender = topSpenderEntry
    ? {
        uid: topSpenderEntry[0],
        name: memberName(topSpenderEntry[0], members),
        amount: topSpenderEntry[1],
      }
    : null;

  const depositedByMember = {};
  deposits.forEach((t) => {
    if (!t.paidBy) return;
    depositedByMember[t.paidBy] = (depositedByMember[t.paidBy] || 0) + t.amount;
  });
  const topDepositorEntry = topEntry(depositedByMember);
  const topDepositor = topDepositorEntry
    ? {
        uid: topDepositorEntry[0],
        name: memberName(topDepositorEntry[0], members),
        amount: topDepositorEntry[1],
      }
    : null;

  return {
    mode,
    transactionCount: transactions.length,
    expenseCount: expenses.length,
    totalSpent,
    totalDeposited,
    averageExpense: expenses.length ? totalSpent / expenses.length : 0,
    topCategory,
    categoryBreakdown,
    biggestExpense,
    topMonth,
    monthlyTrend,
    topSpender,
    topDepositor,
    hasData: transactions.length > 0,
  };
}
