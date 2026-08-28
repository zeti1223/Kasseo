<script setup>
import { useRouter } from "vue-router";

const router = useRouter();

defineProps({
  name: { type: String, required: true },
  currency: { type: String, required: true },
  icon: { type: String, default: null },
  color: { type: String, default: null },
});
defineEmits(["open-settings", "open-export"]);
</script>

<template>
  <div class="mb-4 sm:mb-6">
    <!-- Mobile top bar with back navigation & actions (hidden on desktop) -->
    <div class="flex items-center justify-between gap-2 mb-3 md:hidden">
      <button
        @click="router.push({ name: 'dashboard' })"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary active:scale-95 transition-all py-1.5 px-2.5 -ml-2.5 rounded-lg bg-gray-100/60 dark:bg-gray-800/60"
      >
        <i class="fas fa-chevron-left text-xs"></i>
        <span>{{ $t('common.backToFunds') }}</span>
      </button>

      <div class="flex items-center gap-1.5">
        <button
          @click="$emit('open-export')"
          class="w-9 h-9 rounded-lg bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary flex items-center justify-center active:scale-95 transition-all shadow-xs"
          :title="$t('groups.exportTooltip')"
        >
          <i class="fas fa-file-export text-xs"></i>
        </button>
        <button
          @click="$emit('open-settings')"
          class="w-9 h-9 rounded-lg bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center justify-center active:scale-95 transition-all shadow-xs"
          :title="$t('groups.settingsTooltip')"
        >
          <i class="fas fa-cog text-xs"></i>
        </button>
      </div>
    </div>

    <!-- Title and Fund info -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <div
          v-if="icon"
          class="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center text-white text-sm sm:text-base shadow-xs"
          :style="{ backgroundColor: color }"
        >
          <i :class="icon"></i>
        </div>
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-bold font-display dark:text-white truncate">
            {{ name }}
          </h1>
          <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {{ currency }}
          </p>
        </div>
      </div>

      <!-- Desktop-only actions -->
      <div class="hidden md:flex items-center gap-2">
        <button
          @click="$emit('open-export')"
          class="text-gray-400 hover:text-[#C8A5FC] dark:hover:text-[#C8A5FC] transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          :title="$t('groups.exportTooltip')"
        >
          <i class="fas fa-file-export text-base"></i>
        </button>
        <button
          @click="$emit('open-settings')"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          :title="$t('groups.settingsTooltip')"
        >
          <i class="fas fa-cog text-base"></i>
        </button>
      </div>
    </div>
  </div>
</template>

