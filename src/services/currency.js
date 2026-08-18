// Historical exchange rates from the free Frankfurter API (ECB rates,
// no API key needed), so amounts convert using the rate on the day they happened.
const API_BASE = "https://api.frankfurter.dev/v1";

// date|from|to -> rate, cached in memory (historical rates never change).
const rateCache = new Map();
// date|from|to -> in-flight Promise<rate>, so concurrent lookups for the
// same day share one request.
const inFlight = new Map();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Frankfurter has no rates for today (until markets close) or the future,
// so clamp anything beyond today back to today.
function safeDate(date) {
  const today = todayKey();
  if (!date || date > today) return today;
  return date;
}

async function fetchRate(from, to, date, attempt = 1) {
  const MAX_ATTEMPTS = 4;
  const TIMEOUT_MS = 8000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${API_BASE}/${date}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
    const res = await fetch(url, { signal: controller.signal });

    // Retry on rate-limit/server errors only.
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_ATTEMPTS) {
        await backoff(attempt);
        return fetchRate(from, to, date, attempt + 1);
      }
      throw new Error(`Exchange rate lookup failed (${res.status})`);
    }

    const data = await res.json();
    const rate = data?.rates?.[to];
    if (typeof rate !== "number") {
      throw new Error(`No exchange rate available for ${from}->${to} on ${date}`);
    }
    return rate;
  } catch (err) {
    // Also retry on network error/timeout.
    const isAbort = err.name === "AbortError";
    if (attempt < MAX_ATTEMPTS && (isAbort || err instanceof TypeError)) {
      await backoff(attempt);
      return fetchRate(from, to, date, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function backoff(attempt) {
  const delay = 400 * 2 ** (attempt - 1) + Math.random() * 200;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Rate to convert 1 unit of `from` into `to`, on `date` (YYYY-MM-DD).
export async function getExchangeRate(from, to, date) {
  if (from === to) return 1;
  const d = safeDate(date);
  const key = `${d}|${from}|${to}`;
  if (rateCache.has(key)) return rateCache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = fetchRate(from, to, d)
    .then((rate) => {
      rateCache.set(key, rate);
      inFlight.delete(key);
      return rate;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });
  inFlight.set(key, promise);
  return promise;
}

// Converts `amount` from `from` to `to` using the rate on `date`.
// Returns the converted amount and the (clamped) rate date.
export async function convertCurrency(amount, from, to, date) {
  const rateDate = safeDate(date);
  if (from === to) {
    return { amount: Number(amount), rate: 1, rateDate };
  }
  const rate = await getExchangeRate(from, to, date);
  const converted = Number((Number(amount) * rate).toFixed(2));
  return { amount: converted, rate, rateDate };
}
