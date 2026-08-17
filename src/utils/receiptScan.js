// Calls the Gemini API directly from the browser. There's no server
// component (no Cloud Functions / Blaze plan needed), which means the
// API key ships inside the client bundle — see README/SETUP notes on
// restricting the key by HTTP referrer in Google AI Studio.

const GEMINI_MODEL = "gemini-2.5-flash-lite";

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

function buildPrompt(allCategories) {
  return `This is a photo of a store receipt. Extract every purchased line item from it.
Return ONLY a JSON array, nothing else (no explanation, no markdown code fences):

[
  {
    "name": "item name",
    "quantity": 1,
    "unit_price": 0,
    "total_price": 0,
    "category": "one of: ${allCategories.map((c) => `"${c}"`).join(", ")}"
  }
]

Categorization rules:
- Pick the single best-fitting category from the list above for each item.
- If nothing fits well, use "Other".
- Prices are plain numbers, no currency symbols.
- If the image is unreadable or is not a receipt, return an empty array.`;
}

class ScanError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * Sends the compressed receipt photo straight to Gemini and returns a
 * cleaned-up list of { name, quantity, unitPrice, totalPrice, category }.
 *
 * @param {string} imageBase64 - JPEG bytes, base64-encoded, no data: prefix
 * @param {string[]} allCategories - category names Gemini is allowed to pick from
 * @param {Object} overrides - { normalizedKeyword: category } learned from past corrections
 */
export async function scanReceiptImage(imageBase64, allCategories, overrides) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new ScanError(
      "No Gemini API key is configured (VITE_GEMINI_API_KEY missing from .env).",
      "missing-key",
    );
  }

  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: buildPrompt(allCategories) },
                { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      },
    );
  } catch (err) {
    throw new ScanError(
      "Couldn't reach the AI service — check your connection and try again.",
      "network",
    );
  }

  if (response.status === 429) {
    throw new ScanError(
      "The AI service is busy right now — try again in a few minutes.",
      "rate-limited",
    );
  }
  if (!response.ok) {
    throw new ScanError(
      "Something went wrong reading the receipt.",
      "api-error",
    );
  }

  const result = await response.json();
  const modelText =
    result?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("") || "";

  const parsed = extractJsonArray(modelText);
  if (!Array.isArray(parsed)) {
    throw new ScanError(
      "Couldn't read that receipt — try a clearer photo.",
      "unparsable",
    );
  }

  return parsed
    .filter((it) => it && typeof it.name === "string" && it.name.trim())
    .map((it) => {
      const name = it.name.trim().slice(0, 120);
      return {
        name,
        quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
        unitPrice: Number(it.unit_price) || 0,
        totalPrice: Number(it.total_price) || 0,
        category: resolveCategory(name, it.category, allCategories, overrides),
      };
    });
}

export { ScanError };
