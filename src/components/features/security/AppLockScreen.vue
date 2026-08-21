<script setup>
import { ref, computed, onMounted } from "vue";
import { useTranslation } from "i18next-vue";
import { useAppLockStore } from "@/stores/appLock";
import { useAuthStore } from "@/stores/auth";

const appLockStore = useAppLockStore();
const authStore = useAuthStore();
const { t } = useTranslation();

const digits = ref("");
const error = ref(false);
const shake = ref(false);

const dots = computed(() =>
  Array.from({ length: 6 }, (_, i) => i < digits.value.length),
);

async function pressDigit(d) {
  if (digits.value.length >= 6) return;
  error.value = false;
  digits.value += String(d);
  if (digits.value.length === 6) {
    const pin = digits.value;
    const ok = await appLockStore.unlockWithPin(pin);
    if (!ok) {
      error.value = true;
      shake.value = true;
      setTimeout(() => (shake.value = false), 400);
    }
    digits.value = "";
  }
}

function backspace() {
  error.value = false;
  digits.value = digits.value.slice(0, -1);
}

async function tryBiometric() {
  await appLockStore.unlockWithBiometrics();
}

async function handleSignOut() {
  await authStore.logout();
}

onMounted(() => {
  if (appLockStore.biometricEnabled && appLockStore.biometricAvailable) {
    tryBiometric();
  }
});
</script>

<template>
  <div
    class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background dark:bg-background-dark px-6"
  >
    <div
      class="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6"
    >
      <i class="fas fa-lock text-2xl text-primary"></i>
    </div>
    <h2 class="text-lg font-semibold font-display mb-1 dark:text-white">
      {{ t("appLock.title") }}
    </h2>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-8">
      {{ t("appLock.subtitle") }}
    </p>

    <div class="flex gap-3 mb-2" :class="{ 'animate-shake': shake }">
      <span
        v-for="(filled, i) in dots"
        :key="i"
        class="w-3.5 h-3.5 rounded-full border-2 border-primary transition-colors"
        :class="filled ? 'bg-primary' : 'bg-transparent'"
      />
    </div>
    <p class="text-sm text-error mb-4 h-5">
      {{ error ? t("appLock.wrongPin") : "" }}
    </p>

    <div class="grid grid-cols-3 gap-4 mb-6">
      <button
        v-for="n in [1, 2, 3, 4, 5, 6, 7, 8, 9]"
        :key="n"
        type="button"
        @click="pressDigit(n)"
        class="w-16 h-16 rounded-full text-xl font-medium bg-gray-100 dark:bg-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        {{ n }}
      </button>

      <button
        v-if="appLockStore.biometricEnabled && appLockStore.biometricAvailable"
        type="button"
        @click="tryBiometric"
        class="w-16 h-16 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        <i class="fas fa-fingerprint text-xl text-primary"></i>
      </button>
      <div v-else />

      <button
        type="button"
        @click="pressDigit(0)"
        class="w-16 h-16 rounded-full text-xl font-medium bg-gray-100 dark:bg-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        0
      </button>

      <button
        type="button"
        @click="backspace"
        class="w-16 h-16 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors dark:text-white"
      >
        <i class="fas fa-backspace"></i>
      </button>
    </div>

    <button
      type="button"
      @click="handleSignOut"
      class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
    >
      {{ t("navbar.signOut") }}
    </button>
  </div>
</template>
