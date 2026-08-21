import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  getNotificationPermission,
  requestNotificationPermission,
  showNotification,
  sendPushNotificationToUsers,
  initOneSignal,
} from "@/services/notificationService";
import { useAuthStore } from "./auth";

export const useNotificationsStore = defineStore("notifications", () => {
  // 'granted' | 'denied' | 'default' | 'unsupported'
  const permission = ref(
    "Notification" in window ? getNotificationPermission() : "unsupported",
  );

  // Whether OS push notifications are enabled by the user
  const pushEnabled = ref(
    localStorage.getItem("pushNotificationsEnabled") !== "false",
  );

  const isGranted = computed(() => permission.value === "granted");
  const isSupported = computed(
    () => "Notification" in window || typeof window !== "undefined",
  );

  /**
   * Initialize OneSignal push notification system
   */
  async function init() {
    await initOneSignal();
    if ("Notification" in window) {
      permission.value = getNotificationPermission();
    }
  }

  /**
   * Ask the OS/browser for notification permission.
   * Updates the local `permission` ref.
   */
  async function askPermission() {
    const result = await requestNotificationPermission();
    permission.value = result;
    return result;
  }

  /**
   * Toggle whether push notifications are enabled.
   */
  function togglePush(enabled) {
    pushEnabled.value = enabled;
    localStorage.setItem("pushNotificationsEnabled", String(enabled));
  }

  /**
   * Trigger an OS-level notification.
   *
   * @param {string} title
   * @param {string} body
   * @param {object} [options]
   */
  function notify(title, body, options = {}) {
    if (pushEnabled.value && isGranted.value) {
      showNotification(title, body, options);
    }
  }

  /**
   * Send a test OS push notification
   */
  async function sendTestNotification(t) {
    const title = t ? t("notifications.testTitle") : "Kasseo";
    const body = t
      ? t("notifications.testBody")
      : "A push értesítések sikeresen be vannak állítva!";

    const authStore = useAuthStore();
    if (authStore.user?.uid) {
      // Send real push notification via OneSignal targeted to current user device
      sendPushNotificationToUsers({
        recipientUids: [authStore.user.uid],
        title,
        body,
        data: { type: "test" },
      });
    }

    // Also trigger OS notification immediately
    showNotification(title, body, { icon: "/favicon-192.png" });
  }

  return {
    permission,
    pushEnabled,
    isGranted,
    isSupported,
    init,
    askPermission,
    togglePush,
    notify,
    sendTestNotification,
    sendPushNotificationToUsers,
  };
});
