// Utilities for per-category budget limits: computing cumulative spend for
// the current period, classifying that spend against the limit, and turning
// it into a sorted progress list the UI can render directly.

export const BUDGET_WARNING_THRESHOLD = 0.8; // 80%
export const BUDGET_EXCEEDED_THRESHOLD = 1; // 100%

/**
 * Returns the [start, end) bounds of the calendar month containing `date`.
 * `end` is exclusive (the first instant of the following month).
 */
export function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

/**
 * Sums the converted `amount` of every expense transaction in `categoryName`
 * whose date falls within `range` (defaults to the current calendar month).
 */
export function getCategorySpend(
  transactions,
  categoryName,
  range = getMonthRange(),
) {
  const { start, end } = range;
  return (transactions || [])
    .filter((t) => {
      if (t.type !== "expense" || t.category !== categoryName) return false;
      const d = new Date(t.date);
      return d >= start && d < end;
    })
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

/**
 * Classifies `spend` against `limit` into 'ok' | 'warning' | 'exceeded'.
 * A missing/zero/negative limit is treated as "no budget set" -> 'ok'.
 */
export function getBudgetStatus(spend, limit) {
  if (!limit || limit <= 0) return "ok";
  const percent = spend / limit;
  if (percent >= BUDGET_EXCEEDED_THRESHOLD) return "exceeded";
  if (percent >= BUDGET_WARNING_THRESHOLD) return "warning";
  return "ok";
}

/**
 * Returns the effective spending limit for `budget` in `monthDate`'s
 * calendar month. When `budget.rollover` is enabled, the previous month's
 * unspent amount (limit minus what was actually spent) is added on top of
 * the base limit as credit — or, if last month went over, subtracted as a
 * debit. Only ever looks one month back, and always against that month's
 * own *base* limit (never an already-rolled-over one), so a credit or
 * debit never compounds across more than a single month.
 *
 * Floors at a small positive amount rather than 0 so a fully-eaten-into
 * budget still reads as "exceeded" rather than being mistaken for "no
 * budget set" by `getBudgetStatus`.
 */
export function getEffectiveBudgetLimit(transactions, budget, monthDate = new Date()) {
  const baseLimit = Number(budget?.amount) || 0;
  if (!budget?.rollover || baseLimit <= 0) return baseLimit;

  const prevMonthDate = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const prevRange = getMonthRange(prevMonthDate);
  const prevSpend = getCategorySpend(transactions, budget.name, prevRange);
  const rolloverAmount = baseLimit - prevSpend; // + credit (underspent) / - debit (overspent)

  return Math.max(0.01, baseLimit + rolloverAmount);
}

/**
 * Builds a per-category budget progress list for `monthDate`'s calendar
 * month, sorted by how close each category is to (or past) its limit.
 *
 * `categoryBudgets` is the raw `groups/{id}/categoryBudgets` map: keys are
 * opaque (see `categoryBudgetKey`), values are
 * `{ name, amount, icon?, rollover? }`.
 */
export function computeBudgetProgress(
  transactions,
  categoryBudgets = {},
  monthDate = new Date(),
) {
  const range = getMonthRange(monthDate);
  return Object.entries(categoryBudgets || {})
    .filter(([, budget]) => budget?.name && Number(budget.amount) > 0)
    .map(([key, budget]) => {
      const baseLimit = Number(budget.amount);
      const limit = getEffectiveBudgetLimit(transactions, budget, monthDate);
      const spend = getCategorySpend(transactions, budget.name, range);
      const percent = limit > 0 ? spend / limit : 0;
      return {
        key,
        name: budget.name,
        icon: budget.icon || null,
        rollover: Boolean(budget.rollover),
        baseLimit,
        limit,
        rolloverAmount: limit - baseLimit,
        spend,
        percent,
        status: getBudgetStatus(spend, limit),
      };
    })
    .sort((a, b) => b.percent - a.percent);
}

/**
 * Firebase Realtime Database keys can't contain '.', '#', '$', '[', ']', or
 * '/'. Category names are free text (e.g. "Food & Groceries"), so this
 * percent-encodes anything unsafe to build a stable, deterministic key.
 */
export function categoryBudgetKey(categoryName) {
  return encodeURIComponent(categoryName || "").replace(/\./g, "%2E");
}

/**
 * Given the spend total *before* a just-added expense and its converted
 * amount, returns which threshold ('warning' at 80%, 'exceeded' at 100%)
 * was newly crossed by this transaction, or null if none was crossed.
 * Used so a warning fires once, right when a transaction pushes a category
 * over a threshold, rather than on every subsequent view or transaction.
 */
export function getNewlyCrossedThreshold(spendBefore, addedAmount, limit) {
  if (!limit || limit <= 0) return null;
  const before = spendBefore / limit;
  const after = (spendBefore + addedAmount) / limit;
  if (before < BUDGET_EXCEEDED_THRESHOLD && after >= BUDGET_EXCEEDED_THRESHOLD) {
    return "exceeded";
  }
  if (before < BUDGET_WARNING_THRESHOLD && after >= BUDGET_WARNING_THRESHOLD) {
    return "warning";
  }
  return null;
}
