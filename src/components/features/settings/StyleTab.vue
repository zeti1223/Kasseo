<script setup>
import { FUND_COLORS, FUND_ICONS } from "@/constants/fundStyle";

defineProps({
  color: { type: String, required: true },
  icon: { type: String, required: true },
  isOwner: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});
defineEmits(["set-color", "set-icon"]);

const colors = FUND_COLORS;
const icons = FUND_ICONS;
</script>

<template>
  <div class="space-y-5">
    <!-- Personal color: everyone picks their own, only visible to themselves -->
    <div>
      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {{ $t('fundSettings.styleColorTitle') }}
      </label>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {{ $t('fundSettings.styleColorHelp') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="c in colors"
          :key="c.value"
          type="button"
          :disabled="loading"
          @click="$emit('set-color', c.value)"
          :title="c.label"
          class="w-8 h-8 rounded-full flex items-center justify-center transition-transform disabled:cursor-not-allowed"
          :style="{ backgroundColor: c.value }"
          :class="color === c.value ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-surface-dark scale-110' : 'hover:scale-110'"
        >
          <i v-if="color === c.value" class="fas fa-check text-white text-xs"></i>
        </button>
      </div>
    </div>

    <!-- Central icon: shared across the fund, owner-only -->
    <div>
      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {{ $t('fundSettings.styleIconTitle') }}
      </label>
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {{ $t('fundSettings.styleIconHelp') }}
      </p>
      <div
        class="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-40 overflow-y-auto p-1"
      >
        <button
          v-for="item in icons"
          :key="item.icon"
          type="button"
          :disabled="!isOwner || loading"
          @click="$emit('set-icon', item.icon)"
          :title="item.label"
          class="w-9 h-9 rounded-lg flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm disabled:cursor-not-allowed disabled:hover:bg-transparent"
          :class="{
            'bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] border border-[#C8A5FC]':
              icon === item.icon,
          }"
        >
          <i :class="item.icon"></i>
        </button>
      </div>
      <p v-if="!isOwner" class="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {{ $t('fundSettings.ownerOnlyIcon') }}
      </p>
    </div>
  </div>
</template>
