// Calls the receipt-scan Cloudflare Worker, which holds the real Gemini API
// key server-side (see /worker). The browser never sees that key — it only
// sends the user's own Firebase ID token so the worker can verify identity,
// confirm group membership, and enforce the daily scan limit.

import { auth } from "@/services/firebase/config";

export function extractJsonArray(text) {
  let cleaned = (text || "").trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (err2) {
        return null;
      }
    }
    return null;
  }
}

export function resolveCategory(name, aiCategory, allCategories, overrides) {
  const normalizedName = name.toLowerCase();
  const overrideKey = Object.keys(overrides || {}).find((k) =>
    normalizedName.includes(k),
  );
  if (overrideKey) return overrides[overrideKey];
  if (typeof aiCategory === "string" && allCategories.includes(aiCategory)) {
    return aiCategory;
  }
  return "Other";
}

class ScanError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * Sends a receipt photo to the receipt-scan worker and returns
 * { name, quantity, unitPrice, totalPrice, category } items.
 *
 * The worker itself reserves today's scan slot (server-side rate limit)
 * before calling Gemini, so callers no longer need to do that separately.
 *
 * @param {string} groupId - the fund/group the scan is for (used for the membership + rate-limit check)
 * @param {string} imageBase64 - JPEG bytes, base64-encoded, no data: prefix
 * @param {string[]} allCategories - categories Gemini may pick from
 * @param {Object} overrides - { normalizedKeyword: category } from past corrections
 */
export async function scanReceiptImage(groupId, imageBase64, allCategories, overrides) {
  const workerUrl = import.meta.env.VITE_SCAN_WORKER_URL;
  if (!workerUrl) {
    throw new ScanError(
      "Receipt scanning isn't configured (VITE_SCAN_WORKER_URL missing from .env).",
      "missing-config",
    );
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new ScanError("You need to be signed in to scan a receipt.", "not-authenticated");
  }

  let idToken;
  try {
    idToken = await currentUser.getIdToken();
  } catch (err) {
    throw new ScanError("Couldn't verify your session — please sign in again.", "auth-error");
  }

  let response;
  try {
    response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        groupId,
        imageBase64,
        categories: allCategories,
        overrides,
      }),
    });
  } catch (err) {
    throw new ScanError(
      "Couldn't reach the AI service — check your connection and try again.",
      "network",
    );
  }

  if (response.status === 429) {
    const body = await response.json().catch(() => ({}));
    throw new ScanError(
      body.message || "The AI service is busy right now — try again in a few minutes.",
      "rate-limited",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ScanError(
      body.message || "Something went wrong reading the receipt.",
      body.error || "api-error",
    );
  }

  const result = await response.json();
  if (!Array.isArray(result.items)) {
    throw new ScanError(
      result.message || "Couldn't read that receipt — try a clearer photo.",
      "unparsable",
    );
  }

  return result.items;
}

export { ScanError };
