<script setup>
defineProps({
  name: { type: String, required: true },
  currency: { type: String, required: true },
});
defineEmits(["open-settings"]);
</script>

<template>
  <div>
    <div class="flex items-center gap-4 mb-1">
      <h1 class="text-xl font-bold font-display dark:text-white">{{ name }}</h1>
      <button
        @click="$emit('open-settings')"
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <i class="fas fa-cog"></i>
      </button>
    </div>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">{{ currency }}</p>
  </div>
</template>
