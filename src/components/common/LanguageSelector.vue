<script setup>
import { ref } from "vue";
import { useSettingsStore } from "@/stores/settings";
import { SUPPORTED_LANGUAGES } from "@/i18n";

const props = defineProps({
  variant: {
    type: String,
    default: "navbar", // "navbar" | "dropdown" | "pills" | "compact"
  },
});

const settingsStore = useSettingsStore();
const isOpen = ref(false);

function selectLanguage(code) {
  settingsStore.setLanguage(code);
  isOpen.value = false;
}
</script>

<template>
  <!-- Pills Variant (e.g. in Settings modal) -->
  <div v-if="variant === 'pills'" class="grid grid-cols-2 sm:grid-cols-5 gap-2">
    <button
      v-for="lang in SUPPORTED_LANGUAGES"
      :key="lang.code"
      type="button"
      @click="selectLanguage(lang.code)"
      class="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
      :class="
        settingsStore.language === lang.code
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
      "
    >
      <span :class="lang.flagClass" class="rounded-xs shadow-xs text-base"></span>
      <span>{{ lang.name }}</span>
    </button>
  </div>

  <!-- Navbar / Dropdown Variant -->
  <div v-else class="relative inline-block text-left">
    <button
      type="button"
      @click="isOpen = !isOpen"
      class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors"
      :class="
        variant === 'navbar'
          ? 'text-white hover:bg-primary-dark dark:hover:bg-primary-dark'
          : 'text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm'
      "
      :title="'Language: ' + (SUPPORTED_LANGUAGES.find(l => l.code === settingsStore.language)?.name || 'Language')"
    >
      <span
        :class="SUPPORTED_LANGUAGES.find((l) => l.code === settingsStore.language)?.flagClass"
        class="rounded-xs shadow-xs text-sm"
      ></span>
      <span class="uppercase tracking-wider font-semibold">
        {{ settingsStore.language }}
      </span>
      <i class="fas fa-chevron-down text-[10px] opacity-70"></i>
    </button>

    <!-- Backdrop for outside click -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40"
      @click="isOpen = false"
    />

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="absolute right-0 mt-1.5 w-40 rounded-xl bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-700 shadow-lg py-1 z-50 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/50"
    >
      <button
        v-for="lang in SUPPORTED_LANGUAGES"
        :key="lang.code"
        type="button"
        @click="selectLanguage(lang.code)"
        class="w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors"
        :class="
          settingsStore.language === lang.code
            ? 'bg-[#C8A5FC]/15 text-[#8A5FBF] dark:text-[#C8A5FC] font-semibold'
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
        "
      >
        <div class="flex items-center gap-2">
          <span :class="lang.flagClass" class="rounded-xs shadow-xs text-sm"></span>
          <span>{{ lang.name }}</span>
        </div>
        <i
          v-if="settingsStore.language === lang.code"
          class="fas fa-check text-xs text-[#8A5FBF] dark:text-[#C8A5FC]"
        ></i>
      </button>
    </div>
  </div>
</template>
