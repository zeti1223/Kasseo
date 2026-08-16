<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import SettingsDialog from "@/components/SettingsDialog.vue";

const router = useRouter();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

const showSettingsDialog = ref(false);

async function handleLogout() {
  await authStore.logout();
  router.push({ name: "landing" });
}
</script>

<template>
  <nav class="bg-primary dark:bg-primary-dark-dark text-white shadow-md">
    <div class="max-w-[1100px] mx-auto px-4 flex items-center h-16">
      <div
        class="flex items-center cursor-pointer flex-shrink-0"
        @click="router.push({ name: 'dashboard' })"
      >
        <div
          class="bg-white/20 backdrop-blur-sm rounded-lg p-1.5 mr-2 border border-white/30"
        >
          <img src="/vector.svg" alt="Kasseo" class="h-6 w-auto" />
        </div>
      </div>
      <div class="flex-1" />
      <div class="flex items-center gap-2 mr-3">
        <img
          :src="authStore.user?.photoURL"
          :alt="authStore.user?.displayName"
          class="w-8 h-8 rounded-full object-cover"
        />
        <span class="text-sm hidden sm:inline dark:text-white">{{
          authStore.userProfile?.nickname || authStore.user?.displayName
        }}</span>
      </div>
      <button
        @click="showSettingsDialog = true"
        class="text-white hover:bg-primary-dark dark:hover:bg-primary-dark px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span class="hidden sm:inline">Settings</span>
      </button>
      <button
        @click="handleLogout"
        class="text-white hover:bg-primary-dark dark:hover:bg-primary-dark px-3 py-2 rounded-lg transition-colors"
      >
        Sign out
      </button>
    </div>
  </nav>
  <SettingsDialog v-model="showSettingsDialog" />
</template>
