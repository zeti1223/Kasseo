<script setup>
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import LanguageSelector from "@/components/common/LanguageSelector.vue";

const router = useRouter();
const authStore = useAuthStore();

async function handleLogin() {
  localStorage.setItem("authRedirect", "/dashboard");
  try {
    await authStore.loginWithGoogle();
    if (authStore.user) {
      router.push({ name: "dashboard" });
    }
  } catch (error) {
    // loginWithGoogle already sets authStore.authError; catching here just
    // stops it becoming a silent unhandled rejection (which looks like the
    // button "does nothing").
    console.error("Login failed:", error);
  }
}
</script>

<template>
  <div
    class="flex items-center justify-center relative"
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
    <div class="absolute top-4 right-4 z-10">
      <LanguageSelector variant="dropdown" />
    </div>

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
          {{ $t('landing.tagline') }}
        </p>
      </div>
      <button
        @click="handleLogin"
        class="w-full px-4 py-3 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors flex items-center justify-center gap-2"
      >
        <i class="fab fa-google"></i>
        {{ $t('landing.signInWithGoogle') }}
      </button>
      <p
        v-if="authStore.authError"
        class="text-sm text-red-600 mt-3 text-center break-words"
      >
        {{ authStore.authError }}
      </p>
    </div>
  </div>
</template>
