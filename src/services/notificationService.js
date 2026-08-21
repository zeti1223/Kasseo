import { Capacitor } from "@capacitor/core";

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;

let isOneSignalInitialized = false;

async function getNativeOneSignal() {
  if (typeof window !== "undefined" && window.plugins?.OneSignal) {
    return window.plugins.OneSignal;
  }
  try {
    const module = await import("onesignal-cordova-plugin");
    return module.default || module || (typeof window !== "undefined" ? window.plugins?.OneSignal : null);
  } catch {
    return typeof window !== "undefined" ? window.plugins?.OneSignal : null;
  }
}

/**
 * Initialize OneSignal for either Capacitor (native Android) or Web browser.
 */
export async function initOneSignal() {
  if (!ONESIGNAL_APP_ID) return;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const initNative = async () => {
      try {
        const OneSignal = await getNativeOneSignal();
        if (OneSignal) {
          OneSignal.initialize(ONESIGNAL_APP_ID);
          isOneSignalInitialized = true;
        }
      } catch (err) {
        console.warn("Native OneSignal init failed:", err);
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("deviceready", initNative, { once: true });
    }
    await initNative();
  } else {
    // Web platform
    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal) {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
        });
        isOneSignalInitialized = true;
      });
    } catch (err) {
      console.warn("Web OneSignal init failed:", err);
    }
  }
}

/**
 * Link current logged-in Firebase user UID with OneSignal as external_id.
 */
export async function loginOneSignal(uid) {
  if (!uid || !ONESIGNAL_APP_ID) return;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const doLogin = async () => {
      try {
        const OneSignal = await getNativeOneSignal();
        if (OneSignal) {
          if (!isOneSignalInitialized) {
            OneSignal.initialize(ONESIGNAL_APP_ID);
            isOneSignalInitialized = true;
          }
          if (typeof OneSignal.login === "function") {
            OneSignal.login(uid);
          } else if (typeof OneSignal.setExternalUserId === "function") {
            OneSignal.setExternalUserId(uid);
          }
        }
      } catch (err) {
        console.warn("Native OneSignal login error:", err);
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("deviceready", doLogin, { once: true });
    }
    await doLogin();
  } else {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.login(uid);
      } catch (err) {
        console.warn("Web OneSignal login error:", err);
      }
    });
  }
}

/**
 * Unlink user upon logout.
 */
export async function logoutOneSignal() {
  if (!ONESIGNAL_APP_ID) return;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const doLogout = async () => {
      try {
        const OneSignal = await getNativeOneSignal();
        if (OneSignal) {
          if (typeof OneSignal.logout === "function") {
            OneSignal.logout();
          } else if (typeof OneSignal.removeExternalUserId === "function") {
            OneSignal.removeExternalUserId();
          }
        }
      } catch (err) {
        console.warn("Native OneSignal logout error:", err);
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("deviceready", doLogout, { once: true });
    }
    await doLogout();
  } else {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.logout();
      } catch (err) {
        console.warn("Web OneSignal logout error:", err);
      }
    });
  }
}

/**
 * Request notification permission from the browser/OS / OneSignal.
 * Returns the resulting permission string: 'granted' | 'denied' | 'default'.
 */
export async function requestNotificationPermission() {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const OneSignal = await getNativeOneSignal();
      if (OneSignal?.Notifications?.requestPermission) {
        const granted = await OneSignal.Notifications.requestPermission(true);
        return granted ? "granted" : "denied";
      } else if (OneSignal?.promptForPushNotificationsWithUserResponse) {
        return new Promise((resolve) => {
          OneSignal.promptForPushNotificationsWithUserResponse((accepted) => {
            resolve(accepted ? "granted" : "denied");
          });
        });
      }
    } catch (err) {
      console.warn("Native requestPermission failed:", err);
    }
  } else if (typeof window !== "undefined" && window.OneSignalDeferred && ONESIGNAL_APP_ID) {
    try {
      return new Promise((resolve) => {
        window.OneSignalDeferred.push(async function (OneSignal) {
          try {
            await OneSignal.Notifications.requestPermission();
            const perm = OneSignal.Notifications.permission ? "granted" : "denied";
            resolve(perm);
          } catch {
            if ("Notification" in window) {
              const res = await Notification.requestPermission();
              resolve(res);
            } else {
              resolve("denied");
            }
          }
        });
      });
    } catch {
      // fallback
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Get the current notification permission without prompting.
 */
export function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return Notification.permission;
}

/**
 * Show a local browser/OS notification.
 *
 * @param {string} title
 * @param {string} body
 * @param {object} [options] - Extra options (icon, tag, etc.)
 */
export async function showNotification(title, body, options = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const isNative = Capacitor.isNativePlatform();
  const iconUrl =
    options.browserIcon ||
    (typeof options.icon === "string" &&
    (options.icon.startsWith("/") || options.icon.startsWith("http"))
      ? options.icon
      : isNative
        ? undefined
        : "/favicon-192.png");

  const notificationOptions = {
    body,
    icon: iconUrl,
    badge: "/favicon-192.png",
    tag: options.tag,
    silent: options.silent || false,
  };

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        return await reg.showNotification(title, notificationOptions);
      }
    }
    new Notification(title, notificationOptions);
  } catch (err) {
    try {
      new Notification(title, notificationOptions);
    } catch (e) {
      console.warn("Could not display notification:", e);
    }
  }
}

/**
 * Send real background push notifications to specific users via OneSignal REST API.
 * Supports targeting by external user ID (Firebase UID) across Android and Web.
 *
 * @param {object} params
 * @param {string[]} params.recipientUids - Array of Firebase user UIDs
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {object} [params.data] - Additional data (e.g. { groupId })
 */
export async function sendPushNotificationToUsers({ recipientUids, title, body, data = {} }) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn("OneSignal VITE_ONESIGNAL_APP_ID or VITE_ONESIGNAL_REST_API_KEY not configured.");
    return;
  }

  const validRecipients = (recipientUids || []).filter(Boolean);
  if (validRecipients.length === 0) return;

  const cleanKey = ONESIGNAL_REST_API_KEY.trim();
  const authHeader = cleanKey.startsWith("Basic ") || cleanKey.startsWith("Key ")
    ? cleanKey
    : (cleanKey.startsWith("os_v2_") ? `Key ${cleanKey}` : `Basic ${cleanKey}`);

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: {
      external_id: validRecipients,
    },
    include_external_user_ids: validRecipients,
    channel_for_external_user_ids: "push",
    target_channel: "push",
    headings: {
      en: title,
      hu: title,
      de: title,
      es: title,
      fr: title,
      zh: title,
    },
    contents: {
      en: body || title,
      hu: body || title,
      de: body || title,
      es: body || title,
      fr: body || title,
      zh: body || title,
    },
    data: {
      ...data,
    },
  };

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    const resJson = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn("OneSignal push dispatch failed:", response.status, resJson);
    }
  } catch (error) {
    console.warn("Error sending OneSignal push notification:", error);
  }
}
