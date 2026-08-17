<script setup>
// Shared card shell for every chart on the Dashboard and Group pages —
// keeps the border/shadow/title markup in one place instead of being
// repeated at every call site.
defineProps({
  title: { type: String, default: "" },
});
</script>

<template>
  <div
    class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
  >
    <div class="flex items-center justify-between mb-2">
      <div class="text-base font-medium font-display dark:text-white">
        {{ title }}
      </div>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>
