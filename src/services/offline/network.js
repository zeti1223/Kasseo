import { ref, watch } from "vue";
import { ref as dbRef, onValue } from "firebase/database";
import { db } from "@/services/firebase/config";
import { flushQueue } from "./sync";

// The browser's own view of connectivity — fires instantly, before Firebase
// has had a chance to try (or fail) a connection.
const browserOnline = ref(typeof navigator === "undefined" ? true : navigator.onLine);

// Firebase's own connection state, via the special `.info/connected` path.
// This is the real source of truth for whether a write will actually reach
// the server (browserOnline can be true on a captive portal or a dead
// Wi-Fi with no real internet).
const firebaseConnected = ref(false);

// What the rest of the app should treat as "online": both signals agree.
export const isOnline = ref(browserOnline.value);

let initialized = false;

/**
 * Starts watching connectivity and automatically flushes any writes queued
 * while offline as soon as we're back online. Safe to call more than once —
 * only sets up listeners the first time.
 */
export function initNetworkMonitor() {
  if (initialized) return;
  initialized = true;

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      browserOnline.value = true;
    });
    window.addEventListener("offline", () => {
      browserOnline.value = false;
    });
  }

  try {
    onValue(dbRef(db, ".info/connected"), (snapshot) => {
      firebaseConnected.value = snapshot.val() === true;
    });
  } catch (err) {
    console.warn("Could not monitor Firebase connection state:", err);
  }

  watch(
    [browserOnline, firebaseConnected],
    ([browser, firebase]) => {
      isOnline.value = browser && firebase;
    },
    { immediate: true },
  );

  watch(isOnline, (online) => {
    if (online) flushQueue();
  });
}
