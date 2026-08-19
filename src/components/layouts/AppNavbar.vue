<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import SettingsDialog from "../features/settings/SettingsDialog.vue";

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
          :alt="authStore.userProfile?.nickname || authStore.user?.displayName"
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
        <i class="fas fa-cog"></i>
        <span class="hidden sm:inline">Settings</span>
      </button>
      <button
        @click="handleLogout"
        class="text-white hover:bg-primary-dark dark:hover:bg-primary-dark px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
      >
        <i class="fas fa-sign-out-alt"></i>
        <span class="hidden sm:inline">Sign out</span>
      </button>
    </div>
  </nav>
  <SettingsDialog v-model="showSettingsDialog" />
</template>
