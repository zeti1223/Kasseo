import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { Capacitor } from "@capacitor/core";

const PIN_HASH_KEY = "appLock.pinHash";
const PIN_SALT_KEY = "appLock.pinSalt";
const BIOMETRIC_ENABLED_KEY = "appLock.biometricEnabled";

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

function randomSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

// Guards app content behind an optional 6-digit PIN (and, on top of that,
// optional biometric unlock) on native platforms. Nothing here ever touches
// the network or Firebase — it's a purely local re-entry gate on top of the
// existing Google sign-in, per issue #38 ("Secure the app with a 6 digit pin
// or biometric unlock on android").
export const useAppLockStore = defineStore("appLock", () => {
  const isNative = Capacitor.isNativePlatform();

  const pinHash = ref(localStorage.getItem(PIN_HASH_KEY) || "");
  const pinSalt = ref(localStorage.getItem(PIN_SALT_KEY) || "");
  const biometricEnabled = ref(
    localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true",
  );
  const biometricAvailable = ref(false);

  // Whether the user has an active PIN at all.
  const pinEnabled = computed(() => !!pinHash.value);
  // Whether the lock screen should ever engage (native + PIN set — there's
  // no reason to lock a desktop/web session behind this).
  const lockEnabled = computed(() => isNative && pinEnabled.value);

  // Starts unlocked; App.vue flips this on right after launch (and again
  // whenever the app comes back from the background) via initLockState()/lock().
  const isLocked = ref(false);

  function initLockState() {
    isLocked.value = lockEnabled.value;
  }

  async function checkBiometricAvailability() {
    if (!isNative) {
      biometricAvailable.value = false;
      return;
    }
    try {
      const { NativeBiometric } = await import("capacitor-native-biometric");
      const result = await NativeBiometric.isAvailable();
      biometricAvailable.value = !!result?.isAvailable;
    } catch (err) {
      console.warn("Biometric availability check failed:", err);
      biometricAvailable.value = false;
    }
  }

  async function setPin(pin) {
    const salt = randomSalt();
    const hash = await hashPin(pin, salt);
    pinSalt.value = salt;
    pinHash.value = hash;
    localStorage.setItem(PIN_SALT_KEY, salt);
    localStorage.setItem(PIN_HASH_KEY, hash);
  }

  async function verifyPin(pin) {
    if (!pinHash.value) return false;
    const hash = await hashPin(pin, pinSalt.value);
    return hash === pinHash.value;
  }

  function setBiometricEnabled(enabled) {
    biometricEnabled.value = enabled;
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, String(enabled));
  }

  function disableLock() {
    pinHash.value = "";
    pinSalt.value = "";
    biometricEnabled.value = false;
    localStorage.removeItem(PIN_HASH_KEY);
    localStorage.removeItem(PIN_SALT_KEY);
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    isLocked.value = false;
  }

  async function unlockWithPin(pin) {
    const ok = await verifyPin(pin);
    if (ok) isLocked.value = false;
    return ok;
  }

  async function unlockWithBiometrics() {
    if (!isNative || !biometricEnabled.value || !biometricAvailable.value) {
      return false;
    }
    try {
      const { NativeBiometric } = await import("capacitor-native-biometric");
      await NativeBiometric.verifyIdentity({
        title: "Kasseo",
        reason: "Unlock Kasseo",
      });
      isLocked.value = false;
      return true;
    } catch (err) {
      // Cancelled, no biometrics enrolled, or too many attempts — the
      // person just falls back to the PIN pad that's already on screen.
      return false;
    }
  }

  function lock() {
    if (lockEnabled.value) isLocked.value = true;
  }

  return {
    isNative,
    pinEnabled,
    lockEnabled,
    biometricEnabled,
    biometricAvailable,
    isLocked,
    initLockState,
    checkBiometricAvailability,
    setPin,
    verifyPin,
    setBiometricEnabled,
    disableLock,
    unlockWithPin,
    unlockWithBiometrics,
    lock,
  };
});
