<script setup>
// Generic overlay confirm/alert modal — two buttons for confirmations,
// one for plain alerts.
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
    class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
  >
    <div class="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" @click="close" />
    <div
      class="relative bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-none sm:max-w-[420px] max-h-[90vh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pb-6"
    >
      <!-- Mobile drag handle indicator -->
      <div class="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

      <h3 class="text-lg font-semibold mb-2 dark:text-white">{{ title }}</h3>
      <div class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        <slot />
      </div>
      <div class="flex justify-end gap-2">
        <button
          v-if="showCancel"
          @click="close"
          class="flex-1 sm:flex-initial px-4 py-2.5 sm:py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-center"
        >
          {{ cancelLabel }}
        </button>
        <button
          @click="emit('confirm')"
          :disabled="loading"
          class="flex-1 sm:flex-initial px-5 py-2.5 sm:py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center"
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
