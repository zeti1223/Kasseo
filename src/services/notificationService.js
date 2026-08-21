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
  if (!ONESIGNAL_APP_ID || isOneSignalInitialized) return;
  isOneSignalInitialized = true;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const initNative = async () => {
      try {
        const OneSignal = await getNativeOneSignal();
        if (OneSignal) {
          OneSignal.initialize(ONESIGNAL_APP_ID);
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
        try {
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            allowLocalhostAsSecureOrigin: true,
            notifyButton: {
              enable: false,
            },
          });
        } catch (err) {
          console.warn("Web OneSignal init failed:", err);
        }
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
  await initOneSignal();

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const doLogin = async () => {
      try {
        const OneSignal = await getNativeOneSignal();
        if (OneSignal) {
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
 * Opt in or opt out of OneSignal push subscription.
 */
export async function setOneSignalPushSubscription(enabled) {
  if (!ONESIGNAL_APP_ID) return;

  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    try {
      const OneSignal = await getNativeOneSignal();
      if (OneSignal?.User?.pushSubscription) {
        if (enabled) {
          await OneSignal.User.pushSubscription.optIn();
        } else {
          await OneSignal.User.pushSubscription.optOut();
        }
      }
    } catch (err) {
      console.warn("Native setOneSignalPushSubscription error:", err);
    }
  } else {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        if (OneSignal?.User?.pushSubscription) {
          if (enabled) {
            await OneSignal.User.pushSubscription.optIn();
          } else {
            await OneSignal.User.pushSubscription.optOut();
          }
        }
      } catch (err) {
        console.warn("Web setOneSignalPushSubscription error:", err);
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
  }

  // Web platform
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  try {
    let result = Notification.permission;
    if (result !== "granted" && result !== "denied") {
      result = await Notification.requestPermission();
    }

    if (ONESIGNAL_APP_ID) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal) {
        try {
          if (OneSignal?.Notifications?.requestPermission) {
            await OneSignal.Notifications.requestPermission();
          }
          if (result === "granted" && OneSignal?.User?.pushSubscription) {
            await OneSignal.User.pushSubscription.optIn();
          }
        } catch (e) {
          console.warn("OneSignal Web permission/optIn error:", e);
        }
      });
    }

    return result || Notification.permission || "denied";
  } catch (err) {
    console.warn("requestNotificationPermission error:", err);
    return Notification.permission || "denied";
  }
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
      const reg = await navigator.serviceWorker.ready.catch(() => null) ||
                  await navigator.serviceWorker.getRegistration().catch(() => null);
      if (reg && typeof reg.showNotification === "function") {
        return await reg.showNotification(title, notificationOptions);
      }
    }
    return new Notification(title, notificationOptions);
  } catch {
    try {
      return new Notification(title, notificationOptions);
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

