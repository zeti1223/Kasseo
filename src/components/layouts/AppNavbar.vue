<script setup>
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useTranslation } from "i18next-vue";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { isOnline } from "@/services/offline/network";
import { lastSyncedAt } from "@/services/offline/db";
import { formatLastSynced } from "@/utils/format";
import SettingsDialog from "../features/settings/SettingsDialog.vue";
import LanguageSelector from "../common/LanguageSelector.vue";

const router = useRouter();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const { t } = useTranslation();

// Live-updates as fresh snapshots arrive via onValue (see services/offline/db.js),
// so the tooltip never shows a stale "last synced" time once we're back online.
const offlineTooltip = computed(() => {
  const synced = formatLastSynced(lastSyncedAt.value);
  return synced
    ? `${t("navbar.offlineTooltip")} ${t("navbar.lastSynced", { time: synced })}`
    : t("navbar.offlineTooltip");
});

const showSettingsDialog = ref(false);

// Google's photoURL occasionally fails to load (transient network issues,
// rate limiting, etc). Without this, a failed load just leaves a broken
// image icon in the navbar with no fallback.
const avatarFailed = ref(false);
watch(
  () => authStore.user?.photoURL,
  () => {
    avatarFailed.value = false;
  },
);

async function handleLogout() {
  await authStore.logout();
  router.push({ name: "landing" });
}
</script>

<template>
  <nav class="bg-primary dark:bg-primary-dark-dark text-white shadow-md pt-[env(safe-area-inset-top,0px)]">
    <div class="max-w-[1100px] mx-auto px-3 sm:px-4 flex items-center h-14 sm:h-16">
      <div
        class="flex items-center cursor-pointer flex-shrink-0 active:scale-95 transition-transform"
        @click="router.push({ name: 'dashboard' })"
      >
        <div
          class="bg-white/20 backdrop-blur-sm rounded-xl p-1.5 mr-2 border border-white/30 shadow-xs"
        >
          <img src="/vector.svg" alt="Kasseo" class="h-6 w-auto" />
        </div>
        <span class="font-display font-bold text-lg sm:hidden tracking-tight">Kasseo</span>
      </div>

      <div class="flex-1" />

      <!-- Persistent while offline: local data may be stale and any
           changes are queued until the connection returns. -->
      <div
        v-if="!isOnline"
        class="flex items-center gap-1.5 bg-black/25 text-white text-xs font-semibold px-2.5 py-1 rounded-full mr-2 flex-shrink-0"
        :title="offlineTooltip"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"></span>
        <span>{{ $t('navbar.offline') }}</span>
      </div>

      <!-- User avatar & Profile quick touch -->
      <div
        class="flex items-center gap-2 mr-2 sm:mr-3 cursor-pointer p-1 rounded-lg hover:bg-white/10 active:scale-95 transition-all"
        @click="showSettingsDialog = true"
      >
        <img
          v-if="authStore.user?.photoURL && !avatarFailed"
          :src="authStore.user.photoURL"
          :alt="authStore.userProfile?.nickname || authStore.user?.displayName"
          class="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-white/30"
          @error="avatarFailed = true"
        />
        <div
          v-else
          class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs sm:text-sm font-medium flex-shrink-0 ring-2 ring-white/30"
        >
          {{
            (authStore.userProfile?.nickname || authStore.user?.displayName)
              ?.charAt(0)
              .toUpperCase() || "?"
          }}
        </div>
        <span class="text-sm hidden sm:inline dark:text-white font-medium">{{
          authStore.userProfile?.nickname || authStore.user?.displayName
        }}</span>
      </div>

      <div class="mr-1 sm:mr-2">
        <LanguageSelector variant="navbar" />
      </div>

      <button
        @click="showSettingsDialog = true"
        class="text-white hover:bg-primary-dark dark:hover:bg-primary-dark w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-lg transition-all flex items-center justify-center gap-2 active:scale-95"
        :title="$t('navbar.settings')"
      >
        <i class="fas fa-cog text-sm sm:text-base"></i>
        <span class="hidden sm:inline">{{ $t('navbar.settings') }}</span>
      </button>

      <button
        @click="handleLogout"
        class="text-white hover:bg-primary-dark dark:hover:bg-primary-dark w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-lg transition-all flex items-center justify-center gap-2 active:scale-95 ml-0.5"
        :title="$t('navbar.signOut')"
      >
        <i class="fas fa-sign-out-alt text-sm sm:text-base"></i>
        <span class="hidden sm:inline">{{ $t('navbar.signOut') }}</span>
      </button>
    </div>
  </nav>
  <SettingsDialog v-model="showSettingsDialog" />
</template>
