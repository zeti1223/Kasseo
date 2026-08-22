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
    class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border-l-4 border border-gray-100 dark:border-gray-700 flex flex-col cursor-pointer hover:shadow-md transition-shadow"
    :style="{ borderLeftColor: myColor }"
    @click="$emit('open')"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1 flex items-start gap-3">
        <div
          class="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm"
          :style="{ backgroundColor: myColor }"
        >
          <i :class="icon"></i>
        </div>
        <div>
          <div class="text-lg font-semibold mb-1 font-display dark:text-white">
            {{ group.name }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {{ group.currency }} • {{ $t('dashboard.membersCount', { count: group.memberCount }) }}
          </div>
        </div>
      </div>
      <div class="text-right">
        <div
          class="text-lg font-bold dark:text-white"
          :class="group.balance >= 0 ? 'text-[#A7F49D]' : 'text-[#C1503A]'"
        >
          {{ formatCurrency(group.balance, group.currency) }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ $t('dashboard.currentBalance') }}
        </div>
      </div>
    </div>

    <div class="flex-1" />
    <div class="mt-3">
      <button
        @click.stop="$emit('open')"
        class="w-full text-sm px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
      >
        <i class="fas fa-arrow-right w-4 h-4"></i>
        {{ $t('dashboard.open') }}
      </button>
    </div>
  </div>
</template>
