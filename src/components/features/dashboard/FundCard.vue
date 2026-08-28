<script setup>
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { getMyFundColor, getFundIcon } from "@/constants/fundStyle";
import { formatCurrency } from "@/utils/format";

const props = defineProps({
  group: { type: Object, required: true },
});
defineEmits(["open"]);

const authStore = useAuthStore();
const myColor = computed(() => getMyFundColor(props.group, authStore.user?.uid));
const icon = computed(() => getFundIcon(props.group));
</script>

<template>
  <div
    class="bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm border-l-4 border border-gray-100 dark:border-gray-700 flex flex-col cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
    :style="{ borderLeftColor: myColor }"
    @click="$emit('open')"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1 flex items-start gap-3 min-w-0">
        <div
          class="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center text-white text-sm"
          :style="{ backgroundColor: myColor }"
        >
          <i :class="icon"></i>
        </div>
        <div class="min-w-0 pr-2">
          <div class="text-base sm:text-lg font-semibold mb-0.5 font-display dark:text-white truncate">
            {{ group.name }}
          </div>
          <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
            {{ group.currency }} • {{ $t('dashboard.membersCount', { count: group.memberCount }) }}
          </div>
        </div>
      </div>
      <div class="text-right shrink-0">
        <div
          class="text-base sm:text-lg font-bold font-mono tabular-nums dark:text-white"
          :class="group.balance >= 0 ? 'text-[#3FA34D] dark:text-[#A7F49D]' : 'text-[#C1503A]'"
        >
          {{ formatCurrency(group.balance, group.currency) }}
        </div>
        <div class="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
          {{ $t('dashboard.currentBalance') }}
        </div>
      </div>
    </div>

    <div class="flex-1" />
    <div class="mt-2 sm:mt-3">
      <button
        @click.stop="$emit('open')"
        class="w-full text-xs sm:text-sm py-2 sm:py-1.5 px-3 rounded-lg bg-primary text-white hover:bg-primary-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-medium shadow-xs"
      >
        <span>{{ $t('dashboard.open') }}</span>
        <i class="fas fa-arrow-right text-xs"></i>
      </button>
    </div>
  </div>
</template>
