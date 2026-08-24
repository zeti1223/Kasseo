// Cloudflare Worker: server-side proxy for the Gemini receipt-scan call.
//
// Why this exists: the app used to call Gemini directly from the browser,
// which meant VITE_GEMINI_API_KEY shipped in the public JS bundle (issue #86).
// This worker holds the real key as a Worker secret and is the only thing
// that ever talks to Gemini. The browser talks to this worker instead.
//
// Security model (no Firebase Blaze plan, no service account needed):
//   1. Verify the caller's Firebase ID token ourselves (RS256, Google's
//      public certs) — proves *who* the caller is.
//   2. Re-use the caller's own ID token to read/write the Realtime Database
//      over the REST API. RTDB evaluates our existing database.rules.json
//      exactly as if the browser had made the call directly, so:
//        - group-membership check = same rule as everywhere else in the app
//        - scanLimits increment   = same conditional/validated write as before,
//          just done here instead of in the browser, so a client can no
//          longer skip straight to the Gemini call without reserving a slot.
//   3. Only after both checks pass do we call Gemini, with the secret key.
//
// Required Worker secrets/vars (see wrangler.toml + README below):
//   FIREBASE_PROJECT_ID   (var)    e.g. "financial-app-cccd7"
//   FIREBASE_DATABASE_URL (var)    e.g. "https://financial-app-cccd7-default-rtdb.firebaseio.com"
//   ALLOWED_ORIGIN         (var)   e.g. "https://financial-app-cccd7.web.app"
//   GEMINI_API_KEY         (secret) wrangler secret put GEMINI_API_KEY

import { importX509, jwtVerify } from "jose";

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const DAILY_SCAN_LIMIT = 5;

// Cached across requests within the same isolate. Cheap and fine to lose
// on cold start — we just refetch.
let certsCache = null;
let certsCacheExpiresAt = 0;

async function getGoogleCert(kid) {
  const now = Date.now();
  if (!certsCache || now > certsCacheExpiresAt) {
    const res = await fetch(GOOGLE_CERTS_URL);
    if (!res.ok) throw new Error("Could not fetch Google public certs");
    certsCache = await res.json();
    const cacheControl = res.headers.get("cache-control") || "";
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;
    certsCacheExpiresAt = now + maxAgeMs;
  }
  const x509 = certsCache[kid];
  if (!x509) throw new Error("Unknown key id in token");
  return importX509(x509, "RS256");
}

/** Verifies a Firebase Auth ID token and returns its payload (incl. `sub` = uid). */
async function verifyFirebaseIdToken(idToken, projectId) {
  const { payload } = await jwtVerify(
    idToken,
    async (header) => getGoogleCert(header.kid),
    {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    },
  );
  if (!payload.sub) throw new Error("Token missing subject");
  return payload;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function budapestDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Confirms the user is a member of the group, using the group's own RTDB rules. */
async function assertGroupMember(databaseUrl, groupId, uid, idToken) {
  const url = `${databaseUrl}/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(idToken)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not verify group membership");
  const isMember = await res.json();
  if (!isMember) {
    const err = new Error("Not a member of this group");
    err.status = 403;
    throw err;
  }
}

/**
 * Atomically reserves one of today's scan slots for the group, using the
 * same optimistic-concurrency pattern as the old client-side transaction,
 * just executed here so it can't be skipped.
 */
async function reserveScanSlot(databaseUrl, groupId, uid, idToken) {
  const path = `scanLimits/${encodeURIComponent(groupId)}/${budapestDateKey()}`;
  const base = `${databaseUrl}/${path}.json?auth=${encodeURIComponent(idToken)}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const getRes = await fetch(base, {
      headers: { "X-Firebase-ETag": "true" },
    });
    if (!getRes.ok) throw new Error("Could not read scan limit");
    const etag = getRes.headers.get("ETag");
    const current = await getRes.json();
    const count = current?.count || 0;

    if (count >= DAILY_SCAN_LIMIT) {
      const err = new Error("Daily scan limit reached");
      err.status = 429;
      throw err;
    }

    const putRes = await fetch(base, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "if-match": etag || "",
      },
      body: JSON.stringify({ count: count + 1, updatedAt: Date.now() }),
    });

    if (putRes.status === 412) continue; // lost the race, retry
    if (!putRes.ok) throw new Error("Could not reserve scan slot");
    return;
  }

  throw new Error("Could not reserve scan slot (too much contention)");
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

function extractJsonArray(text) {
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

function resolveCategory(name, aiCategory, allCategories, overrides) {
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

async function callGemini(apiKey, imageBase64, allCategories) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
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
      }),
    },
  );

  if (res.status === 429) {
    const err = new Error("The AI service is busy right now — try again in a few minutes.");
    err.status = 429;
    throw err;
  }
  if (!res.ok) {
    const err = new Error("Something went wrong reading the receipt.");
    err.status = 502;
    throw err;
  }

  const result = await res.json();
  const modelText =
    result?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return extractJsonArray(modelText);
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "method-not-allowed" }, 405, origin);
    }

    const authHeader = request.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return jsonResponse({ error: "missing-token", message: "No auth token provided." }, 401, origin);
    }

    let uid;
    try {
      const payload = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
      uid = payload.sub;
    } catch (err) {
      return jsonResponse({ error: "invalid-token", message: "Could not verify identity." }, 401, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return jsonResponse({ error: "bad-request", message: "Invalid JSON body." }, 400, origin);
    }

    const { groupId, imageBase64, categories, overrides } = body || {};
    if (
      typeof groupId !== "string" ||
      !groupId ||
      typeof imageBase64 !== "string" ||
      !imageBase64 ||
      !Array.isArray(categories) ||
      categories.length === 0
    ) {
      return jsonResponse({ error: "bad-request", message: "Missing groupId, imageBase64 or categories." }, 400, origin);
    }

    try {
      await assertGroupMember(env.FIREBASE_DATABASE_URL, groupId, uid, idToken);
      await reserveScanSlot(env.FIREBASE_DATABASE_URL, groupId, uid, idToken);

      const parsed = await callGemini(env.GEMINI_API_KEY, imageBase64, categories);
      if (!Array.isArray(parsed)) {
        return jsonResponse({ error: "unparsable", message: "Couldn't read that receipt — try a clearer photo." }, 200, origin);
      }

      const items = parsed
        .filter((it) => it && typeof it.name === "string" && it.name.trim())
        .map((it) => {
          const name = it.name.trim().slice(0, 120);
          return {
            name,
            quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
            unitPrice: Number(it.unit_price) || 0,
            totalPrice: Number(it.total_price) || 0,
            category: resolveCategory(name, it.category, categories, overrides || {}),
          };
        });

      return jsonResponse({ items }, 200, origin);
    } catch (err) {
      const status = err.status || 500;
      return jsonResponse(
        { error: "scan-failed", message: err.message || "Something went wrong reading the receipt." },
        status,
        origin,
      );
    }
  },
};
