<script setup>
defineProps({
  name: { type: String, required: true },
  currency: { type: String, required: true },
});
defineEmits(["open-settings", "open-export"]);
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-xl font-bold font-display dark:text-white">{{ name }}</h1>
      <div class="flex items-center gap-2">
        <button
          @click="$emit('open-export')"
          class="text-gray-400 hover:text-[#C8A5FC] dark:hover:text-[#C8A5FC] transition-colors p-1"
          :title="$t('groups.exportTooltip')"
        >
          <i class="fas fa-file-export"></i>
        </button>
        <button
          @click="$emit('open-settings')"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
          :title="$t('groups.settingsTooltip')"
        >
          <i class="fas fa-cog"></i>
        </button>
      </div>
    </div>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">{{ currency }}</p>
  </div>
</template>
