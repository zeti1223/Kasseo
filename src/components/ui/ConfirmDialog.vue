<script setup>
// Generic overlay confirm/alert modal. Covers both "confirm this
// destructive action" (two buttons) and plain alerts (one button) —
// used by FundSettingsDialog and TransactionList so the modal markup
// only needs to exist once.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  confirmLabel: { type: String, default: "Confirm" },
  cancelLabel: { type: String, default: "Cancel" },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  showCancel: { type: Boolean, default: true },
});
const emit = defineEmits(["update:modelValue", "confirm"]);

function close() {
  emit("update:modelValue", false);
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-[60] flex items-center justify-center"
  >
    <div class="absolute inset-0 bg-black/50" @click="close" />
    <div
      class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[420px] mx-4"
    >
      <h3 class="text-lg font-semibold mb-2 dark:text-white">{{ title }}</h3>
      <div class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        <slot />
      </div>
      <div class="flex justify-end gap-2">
        <button
          v-if="showCancel"
          @click="close"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {{ cancelLabel }}
        </button>
        <button
          @click="emit('confirm')"
          :disabled="loading"
          class="px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="
            danger
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-[#C8A5FC] hover:bg-[#A78BCA]'
          "
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
