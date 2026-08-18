<script setup>
import { computed } from "vue";

const props = defineProps({
  currency: { type: String, required: true },
  currencies: { type: Array, required: true },
  isOwner: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  // { done, total } while transactions are being reconverted, else null.
  recalcProgress: { type: Object, default: null },
  // How many transactions failed to convert on the last attempt.
  recalcFailedCount: { type: Number, default: 0 },
});
defineEmits(["update:currency", "save", "retry", "cancel"]);

const statusText = computed(() => {
  if (!props.loading) return null;
  const p = props.recalcProgress;
  if (p && p.total > 0) {
    return `Recalculating transactions… ${p.done}/${p.total}`;
  }
  if (p) return "Recalculating existing transactions…";
  return "Saving…";
});
</script>

<template>
  <div class="space-y-4">
    <div>
      <label
        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >Current currency</label
      >
      <select
        :value="currency"
        @change="$emit('update:currency', $event.target.value)"
        :disabled="!isOwner || loading"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white"
      >
        <option v-for="curr in currencies" :key="curr" :value="curr">
          {{ curr }}
        </option>
      </select>
      <p v-if="!isOwner" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Only the owner can change currency
      </p>
      <p
        v-else-if="!loading && !recalcFailedCount"
        class="text-xs text-gray-500 dark:text-gray-400 mt-1"
      >
        Changing currency reconverts every existing transaction using the
        exchange rate on the day it happened — amounts aren't just relabeled.
      </p>
    </div>

    <!-- Reconversion progress -->
    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-[#8A5FBF] dark:text-[#C8A5FC] bg-[#C8A5FC]/10 rounded-lg px-3 py-2"
    >
      <i class="fas fa-spinner fa-spin"></i>
      <span>{{ statusText }}</span>
    </div>
    <div
      v-if="loading && recalcProgress && recalcProgress.total > 0"
      class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
    >
      <div
        class="h-full bg-[#C8A5FC] transition-all duration-150"
        :style="{
          width: `${Math.min(100, (recalcProgress.done / recalcProgress.total) * 100)}%`,
        }"
      ></div>
    </div>

    <!-- Failed conversions: offer a retry -->
    <div
      v-if="!loading && recalcFailedCount > 0"
      class="flex items-start gap-2 text-sm text-[#C1503A] bg-[#C1503A]/10 rounded-lg px-3 py-2"
    >
      <i class="fas fa-triangle-exclamation mt-0.5"></i>
      <div class="flex-1">
        <p>
          Couldn't fetch exchange rates for
          {{ recalcFailedCount }}
          transaction{{ recalcFailedCount === 1 ? "" : "s" }} — those still
          show their old amount.
        </p>
        <button
          @click="$emit('retry')"
          class="mt-1 font-medium underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    </div>

    <div v-if="isOwner" class="flex justify-end gap-2">
      <button
        @click="$emit('cancel')"
        :disabled="loading"
        class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        @click="$emit('save')"
        :disabled="loading"
        class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin"></i>
        {{ loading ? "Saving…" : "Save" }}
      </button>
    </div>
  </div>
</template>
