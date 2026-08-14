<script setup>
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

async function handleLogin() {
  // Store redirect URL in localStorage before login
  const redirectPath = route.query.redirect || "/dashboard";
  localStorage.setItem("authRedirect", redirectPath);

  await authStore.loginWithGoogle();

  // Retrieve and clear the stored redirect
  const storedRedirect = localStorage.getItem("authRedirect");
  localStorage.removeItem("authRedirect");

  if (storedRedirect && storedRedirect !== "/dashboard") {
    router.push(storedRedirect);
  } else {
    router.push({ name: "dashboard" });
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
          <img src="/vector.svg" alt="Kassio" class="w-8 h-8" />
        </div>
        <h1 class="text-xl font-bold font-display dark:text-white">Kassio</h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Log shared deposits and expenses with the people you split a fund
          with, in real time.
        </p>
      </div>
      <button
        @click="handleLogin"
        class="w-full px-4 py-3 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
          />
        </svg>
        Sign in with Google
      </button>
    </div>
  </div>
</template>
