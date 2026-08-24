# kasseo-receipt-scan (Cloudflare Worker)

Server-side proxy for the Gemini receipt-scan call. Fixes #86: the Gemini
API key now lives only as a Worker secret and is never shipped to the
browser. The worker also verifies the caller's Firebase ID token, checks
group membership, and reserves the daily scan slot itself — so a client
can no longer bypass the rate limit by calling Gemini directly.

Free tier is enough (100k requests/day) — no Firebase Blaze plan needed.

## 1. Install & log in

```bash
cd worker
npm install
npx wrangler login
```

## 2. Configure

Edit `wrangler.toml`:

- `FIREBASE_PROJECT_ID` — your Firebase project id (from `.firebaserc` / Firebase console)
- `FIREBASE_DATABASE_URL` — your RTDB URL (same value as `VITE_FIREBASE_DATABASE_URL`)
- `ALLOWED_ORIGIN` — the exact origin your app is served from, e.g.
  `https://financial-app-cccd7.web.app` (add a second `wrangler.toml` env
  block, or loosen this, if you also serve from a custom domain)

Set the real secret (never committed to git):

```bash
npx wrangler secret put GEMINI_API_KEY
# paste your Gemini API key when prompted
```

## 3. Deploy

```bash
npm run deploy
```

Wrangler prints the deployed URL, e.g.
`https://kasseo-receipt-scan.<your-subdomain>.workers.dev`.

## 4. Point the app at it

In the main app's `.env` (and as a GitHub Actions secret named
`VITE_SCAN_WORKER_URL` for the existing Firebase Hosting / APK workflows):

``` env
VITE_SCAN_WORKER_URL=https://kasseo-receipt-scan.<your-subdomain>.workers.dev
```

Redeploy the app. The old `VITE_GEMINI_API_KEY` variable/secret is no
longer used anywhere and can be deleted from `.env` and from your GitHub
repo secrets.

## How it enforces security

1. Verifies the `Authorization: Bearer <Firebase ID token>` against
   Google's public certs (RS256) — no service account needed.
2. Reads `groups/{groupId}/members/{uid}` from your Realtime Database
   *using the caller's own ID token*, so it's evaluated by the exact same
   `database.rules.json` the app already ships — a non-member gets 403.
3. Reserves `scanLimits/{groupId}/{date}` with a conditional (ETag)
   RTDB write — the same optimistic-concurrency pattern the app used to
   do client-side, just now impossible to skip.
4. Only then calls Gemini, with the secret key, and returns parsed items.

No database rule changes were needed — the worker acts "as" the signed-in
user for RTDB purposes, since it forwards their own ID token.
