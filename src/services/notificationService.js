import { Capacitor } from "@capacitor/core";

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;

let isOneSignalInitialized = false;

/**
 * Initialize OneSignal for either Capacitor (native Android) or Web browser.
 */
export async function initOneSignal() {
  if (isOneSignalInitialized || !ONESIGNAL_APP_ID) return;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const module = await import("onesignal-cordova-plugin");
      const OneSignal = module.default || module || window.plugins?.OneSignal;
      if (OneSignal) {
        OneSignal.initialize(ONESIGNAL_APP_ID);
        isOneSignalInitialized = true;
      }
    } catch (err) {
      console.warn("Native OneSignal plugin could not be initialized:", err);
    }
  } else {
    // Web platform
    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal) {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
        });
        isOneSignalInitialized = true;
      });
    } catch (err) {
      console.warn("Web OneSignal could not be initialized:", err);
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
    try {
      const module = await import("onesignal-cordova-plugin");
      const OneSignal = module.default || module || window.plugins?.OneSignal;
      if (OneSignal?.login) {
        OneSignal.login(uid);
      }
    } catch (err) {
      console.warn("Native OneSignal login failed:", err);
    }
  } else {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.login(uid);
      } catch (err) {
        console.warn("Web OneSignal login failed:", err);
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
    try {
      const module = await import("onesignal-cordova-plugin");
      const OneSignal = module.default || module || window.plugins?.OneSignal;
      if (OneSignal?.logout) {
        OneSignal.logout();
      }
    } catch (err) {
      console.warn("Native OneSignal logout failed:", err);
    }
  } else {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.logout();
      } catch (err) {
        console.warn("Web OneSignal logout failed:", err);
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
      const module = await import("onesignal-cordova-plugin");
      const OneSignal = module.default || module || window.plugins?.OneSignal;
      if (OneSignal?.Notifications?.requestPermission) {
        const granted = await OneSignal.Notifications.requestPermission(true);
        return granted ? "granted" : "denied";
      }
    } catch (err) {
      console.warn("Native requestPermission failed:", err);
    }
  } else if (window.OneSignalDeferred && ONESIGNAL_APP_ID) {
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

  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Get the current notification permission without prompting.
 */
export function getNotificationPermission() {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

/**
 * Show a local browser/OS notification (used for foreground feedback).
 * Falls back to no-op if permission is not granted.
 *
 * @param {string} title
 * @param {string} body
 * @param {object} [options] - Extra options (icon, tag, etc.)
 */
export async function showNotification(title, body, options = {}) {
  if (!("Notification" in window)) return;
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
 * Free tier supports targeting by external user ID (Firebase UID).
 *
 * @param {object} params
 * @param {string[]} params.recipientUids - Array of Firebase user UIDs
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {object} [params.data] - Additional data (e.g. { groupId })
 */
export async function sendPushNotificationToUsers({ recipientUids, title, body, data = {} }) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return;
  }

  const validRecipients = (recipientUids || []).filter(Boolean);
  if (validRecipients.length === 0) return;

  try {
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      target_channel: "push",
      include_aliases: {
        external_id: validRecipients,
      },
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

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      console.warn("OneSignal push dispatch failed:", response.status, errJson);
    }
  } catch (error) {
    console.warn("Error sending OneSignal push notification:", error);
  }
}
