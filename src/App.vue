<script setup>
import { onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useAppLockStore } from "@/stores/appLock";
import AppNavbar from "@/components/layouts/AppNavbar.vue";
import AppLockScreen from "@/components/features/security/AppLockScreen.vue";

const authStore = useAuthStore();
const appLockStore = useAppLockStore();

let removeAppStateListener = null;

onMounted(async () => {
  await appLockStore.checkBiometricAvailability();
  appLockStore.initLockState();

  // Re-lock whenever the app is backgrounded (switching apps, screen off,
  // etc), so the PIN/biometric gate isn't just a one-time check on launch.
  if (appLockStore.isNative) {
    try {
      const { App: CapacitorApp } = await import("@capacitor/app");
      const listener = await CapacitorApp.addListener(
        "appStateChange",
        ({ isActive }) => {
          if (!isActive) {
            appLockStore.lock();
          }
        },
      );
      removeAppStateListener = () => listener.remove();
    } catch (err) {
      console.warn("Could not attach app state listener:", err);
    }
  }
});

onUnmounted(() => {
  removeAppStateListener?.();
});
</script>

<template>
  <div
    class="min-h-screen bg-background dark:bg-background-dark transition-colors"
  >
    <template v-if="authStore.user && appLockStore.isLocked">
      <AppLockScreen />
    </template>
    <template v-else>
      <AppNavbar v-if="authStore.user" />
      <main>
        <router-view />
      </main>
    </template>
  </div>
</template>
