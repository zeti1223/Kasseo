<script setup>
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const loading = ref(false);
const errorMessage = ref("");

async function handleLogin() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const redirectPath = route.query.redirect || "/dashboard";
    localStorage.setItem("authRedirect", redirectPath);

    await authStore.loginWithGoogle();

    if (authStore.user) {
      const storedRedirect = localStorage.getItem("authRedirect");
      localStorage.removeItem("authRedirect");

      if (
        storedRedirect &&
        storedRedirect !== "/dashboard" &&
        storedRedirect !== "/login"
      ) {
        router.push(storedRedirect);
      } else {
        router.push({ name: "dashboard" });
      }
    }
  } catch (err) {
    console.error("Login error:", err);
    if (err?.code !== "auth/popup-closed-by-user") {
      errorMessage.value = err?.message || "Could not sign in with Google.";
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="flex items-center justify-center"
    style="
      min-height: 100vh;
      background: radial-gradient(
        circle at 20% 20%,
        #c8a5fc 0%,
        #a78bca 60%,
        #8b6fa8 100%
      );
    "
  >
    <div
      class="bg-white dark:bg-surface-dark rounded-lg p-8 shadow-lg max-w-[380px] w-full mx-4"
    >
      <div class="text-center mb-6">
        <div
          class="w-14 h-14 bg-[#C8A5FC] rounded-full flex items-center justify-center mx-auto mb-3"
        >
          <img src="/vector.svg" alt="Kasseo" class="w-8 h-8" />
        </div>
        <h1 class="text-xl font-bold font-display dark:text-white">Kasseo</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Log shared deposits and expenses with the people you split a fund
          with, in real time.
        </p>
      </div>

      <div
        v-if="errorMessage || authStore.authError"
        class="bg-[#C1503A]/10 border border-[#C1503A] text-[#C1503A] rounded-lg p-3 mb-4 text-xs break-words text-center"
      >
        {{ errorMessage || authStore.authError }}
      </div>

      <button
        @click="handleLogin"
        :disabled="loading"
        class="w-full px-4 py-3 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin"></i>
        <i v-else class="fab fa-google"></i>
        Sign in with Google
      </button>
    </div>
  </div>
</template>
