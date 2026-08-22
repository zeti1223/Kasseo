/**
 * Formats a number into a compact string representation with up to 2 decimal places:
 * - Values >= 1,000,000 (or <= -1,000,000) are formatted with suffix 'M' (e.g. 1234567 -> 1.23M, 1000000 -> 1M)
 * - Values >= 1,000 (or <= -1,000) are formatted with suffix 'k' (e.g. 1000 -> 1k, 1500 -> 1.5k)
 * - Other values are formatted with up to 2 decimal places.
 *
 * @param {number|string} value
 * @returns {string}
 */
export function formatCompactNumber(value) {
  if (value === null || value === undefined || value === "") return "0";
  const num = Number(value);
  if (isNaN(num)) return "0";

  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  // Boundary check for rounding up to 1B (e.g. 999,999,999.995+)
  if (abs >= 999_999_999.995) {
    const formatted = parseFloat((abs / 1_000_000_000).toFixed(2));
    return `${sign}${formatted}B`;
  }

  // Boundary check for rounding up to 1M (e.g. 999,999.995+)
  if (abs >= 999_999.995) {
    const formatted = parseFloat((abs / 1_000_000).toFixed(2));
    return `${sign}${formatted}M`;
  }

  // Boundary check for rounding up to 1k (e.g. 999.995+)
  if (abs >= 999.995) {
    const formatted = parseFloat((abs / 1_000).toFixed(2));
    return `${sign}${formatted}k`;
  }

  const formatted = parseFloat(abs.toFixed(2));
  return `${sign}${formatted}`;
}

/**
 * Formats an amount with optional currency code.
 *
 * @param {number|string} amount
 * @param {string} [currency]
 * @returns {string}
 */
export function formatCurrency(amount, currency) {
  const formatted = formatCompactNumber(amount);
  return currency ? `${formatted} ${currency}` : formatted;
}
