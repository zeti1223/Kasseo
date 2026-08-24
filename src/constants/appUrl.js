import { Capacitor } from "@capacitor/core";

// The publicly hosted URL of the web app (Firebase Hosting).
// Can be overridden per-environment via VITE_APP_URL, e.g. for a custom domain.
const PROD_APP_URL = "https://kasseo.eu";

/**
  Returns the base URL that should be used when building links meant to be
 * shared with other people (invite links, QR codes, etc.).
 *
 * On the web, `window.location.origin` is correct — it points at wherever the
 * app is actually hosted.
 *
 * Inside the native Android/iOS app (Capacitor), the WebView serves the
 * bundled files from a local origin (e.g. `http://localhost` or
 * `capacitor://localhost`) rather than the real hosted domain. Using
 * `window.location.origin` there produces links like
 * `http://localhost/join/abc123`, which are useless to whoever receives them.
 * In that case we fall back to the known public app URL instead.
 */
export function getAppBaseUrl() {
  if (Capacitor.isNativePlatform()) {
    return import.meta.env.VITE_APP_URL || PROD_APP_URL;
  }
  return window.location.origin;
}
