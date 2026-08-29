<script setup>
import { computed } from "vue";

const props = defineProps({
  mode: { type: String, required: true },
  modes: { type: Array, required: true },
  isOwner: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});
defineEmits(["change"]);

const canEdit = computed(() => props.isAdmin || props.isOwner);
</script>

<template>
  <div class="space-y-3">
    <button
      v-for="opt in modes"
      :key="opt.value"
      type="button"
      :disabled="!canEdit || loading"
      @click="$emit('change', opt.value)"
      class="w-full text-left p-3 rounded-lg border transition-colors disabled:cursor-not-allowed"
      :class="
        mode === opt.value
          ? 'border-[#C8A5FC] bg-[#C8A5FC]/10'
          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
      "
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium dark:text-white">{{ opt.label }}</span>
        <span
          v-if="mode === opt.value"
          class="text-xs font-medium text-[#C8A5FC]"
          >{{ $t('common.selected') }}</span
        >
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {{ opt.description }}
      </p>
    </button>
    <p v-if="!canEdit" class="text-xs text-gray-500 dark:text-gray-400">
      {{ $t('fundSettings.adminOnlyMode') }}
    </p>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      {{ $t('fundSettings.modeSwitchNote') }}
    </p>
  </div>
</template>
