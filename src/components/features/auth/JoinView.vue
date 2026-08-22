<script setup>
import { ref, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useGroupsStore } from "@/stores/groups";
import { useAuthStore } from "@/stores/auth";
import { useTranslation } from "i18next-vue";
import { Capacitor } from "@capacitor/core";
import LanguageSelector from "@/components/common/LanguageSelector.vue";

const route = useRoute();
const router = useRouter();
const groupsStore = useGroupsStore();
const authStore = useAuthStore();
const { t } = useTranslation();

const loading = ref(false);
const signingIn = ref(false);
const error = ref("");

// Show the "Open in App" overlay whenever visiting on the web
const showOpenInApp = ref(!Capacitor.isNativePlatform());
// After tapping "Open in App", show a soft fallback hint if the app didn't open
const showDeepLinkFallback = ref(false);

function openInApp() {
  const groupId = route.params.id;
  window.location.href = `kasseo://join/${groupId}`;
  // After 750 ms, if we're still here the app is probably not installed
  setTimeout(() => {
    showDeepLinkFallback.value = true;
  }, 750);
}

function continueInBrowser() {
  showOpenInApp.value = false;
}

// ── Sign-in ──────────────────────────────────────────────────────────────────

async function handleSignIn() {
  signingIn.value = true;
  error.value = "";
  try {
    await authStore.loginWithGoogle();
    // watch(authStore.user) below will trigger the join once user is set
  } catch (e) {
    console.error("Sign-in error:", e);
    error.value = t("login.errorDefault");
    signingIn.value = false;
  }
}

// ── Auto-join after sign-in ───────────────────────────────────────────────────

// When the user becomes authenticated (either they were already logged in on
// mount, or they just signed in via the join card), attempt the join immediately.
watch(
  () => authStore.user,
  async (newUser) => {
    if (newUser && !loading.value) {
      await handleJoin();
    }
  },
);

// ── Join ──────────────────────────────────────────────────────────────────────

async function handleJoin() {
  if (!authStore.user) {
    error.value = t("join.signInRequired");
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    await groupsStore.joinGroup(route.params.id);
    router.push({ name: "group", params: { id: route.params.id } });
  } catch (e) {
    console.error("Join error:", e);
    error.value = t("join.invalidLink");
  } finally {
    loading.value = false;
    signingIn.value = false;
  }
}

// ── Mount ─────────────────────────────────────────────────────────────────────

onMounted(() => {
  // If the user is already authenticated and we're on native, join straight away.
  // On web, the "Open in App" overlay is shown first; the join card handles auth.
  if (authStore.user && Capacitor.isNativePlatform()) {
    handleJoin();
  }
});
</script>

<template>
  <div class="flex items-center justify-center relative" style="min-height: 80vh">
    <div class="absolute top-4 right-4 z-10">
      <LanguageSelector variant="dropdown" />
    </div>

    <!-- ── "Open in App" overlay ─────────────────────────────────────────── -->
    <Transition name="fade">
      <div
        v-if="showOpenInApp"
        class="absolute inset-0 z-20 flex items-center justify-center bg-background/80 dark:bg-background-dark/80 backdrop-blur-sm px-4"
      >
        <div
          class="bg-white dark:bg-surface-dark rounded-2xl p-8 text-center shadow-xl max-w-[360px] w-full"
        >
          <!-- App icon -->
          <div
            class="w-16 h-16 bg-[#C8A5FC] rounded-2xl flex items-center justify-center mx-auto mb-4"
          >
            <i class="fas fa-layer-group text-white text-2xl"></i>
          </div>

          <h2 class="text-xl font-bold font-display dark:text-white mb-2">
            {{ $t("join.openInAppTitle") }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {{ $t("join.openInAppPrompt") }}
          </p>

          <!-- Soft fallback shown 750 ms after tapping "Open in App" -->
          <p
            v-if="showDeepLinkFallback"
            class="text-xs text-amber-500 dark:text-amber-400 mb-4"
          >
            {{ $t("join.deepLinkFallback") }}
          </p>

          <button
            @click="openInApp"
            class="w-full px-4 py-3 bg-[#C8A5FC] text-white font-semibold rounded-xl hover:bg-[#A78BCA] transition-colors mb-3"
          >
            <i class="fas fa-mobile-alt mr-2"></i>
            {{ $t("join.openInApp") }}
          </button>

          <button
            @click="continueInBrowser"
            class="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors py-1"
          >
            {{ $t("join.continueInBrowser") }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── Join card ─────────────────────────────────────────────────────── -->
    <div
      class="bg-white dark:bg-surface-dark rounded-lg p-8 text-center shadow-lg max-w-[380px] w-full mx-4"
      :class="{ 'opacity-30 pointer-events-none select-none': showOpenInApp }"
    >
      <div
        class="w-14 h-14 bg-[#C8A5FC] rounded-full flex items-center justify-center mx-auto mb-3"
      >
        <i class="fas fa-user-plus text-white"></i>
      </div>
      <h1 class="text-lg font-semibold mb-2 font-display dark:text-white">
        {{ $t("join.title") }}
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {{ $t("join.subtitle") }}
      </p>

      <div
        v-if="error"
        class="bg-[#C1503A]/10 border border-[#C1503A] text-[#C1503A] rounded-lg p-3 mb-4"
      >
        {{ error }}
      </div>

      <!-- Authenticated: Join button -->
      <button
        v-if="authStore.user"
        @click="handleJoin"
        :disabled="loading"
        class="w-full px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin"></i>
        {{ $t("join.joinFund") }}
      </button>

      <!-- Unauthenticated: Sign in with Google -->
      <button
        v-else
        @click="handleSignIn"
        :disabled="signingIn"
        class="w-full px-4 py-2 bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
      >
        <i v-if="signingIn" class="fas fa-spinner fa-spin"></i>
        <svg
          v-else
          class="w-4 h-4"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {{ $t("join.signInToJoin") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
