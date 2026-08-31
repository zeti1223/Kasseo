<script setup>
import { computed } from "vue";
import { useTranslation } from "i18next-vue";
import { computeBudgetProgress } from "@/utils/budgets";
import { getCategoryIcon, getCategoryLabel } from "@/constants/categories";
import { formatCurrency } from "@/utils/format";

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  categoryBudgets: { type: Object, default: () => ({}) },
  currency: { type: String, default: "" },
});
const { t } = useTranslation();

const progress = computed(() =>
  computeBudgetProgress(props.transactions, props.categoryBudgets),
);

const barColor = {
  ok: "bg-[#7FB88A]",
  warning: "bg-[#E0A94A]",
  exceeded: "bg-[#C1503A]",
};
const textColor = {
  ok: "text-[#5C8F66] dark:text-[#7FB88A]",
  warning: "text-[#B8863A] dark:text-[#E0A94A]",
  exceeded: "text-[#C1503A]",
};

function label(item) {
  return getCategoryLabel(item.name, t) || item.name;
}
</script>

<template>
  <div v-if="progress.length === 0" class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
    {{ $t('budgets.noneSet') }}
  </div>
  <div v-else class="space-y-4">
    <div v-for="item in progress" :key="item.key">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2 min-w-0">
          <i
            :class="getCategoryIcon(item.name, item.icon)"
            class="text-xs text-gray-500 dark:text-gray-400 shrink-0"
          ></i>
          <span class="text-sm font-medium dark:text-white truncate">{{
            label(item)
          }}</span>
        </div>
        <span class="text-xs font-medium shrink-0" :class="textColor[item.status]">
          {{ formatCurrency(item.spend, currency) }} / {{ formatCurrency(item.limit, currency) }}
        </span>
      </div>
      <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="barColor[item.status]"
          :style="{ width: `${Math.min(100, item.percent * 100)}%` }"
        ></div>
      </div>
      <p v-if="item.status === 'exceeded'" class="text-xs mt-1" :class="textColor.exceeded">
        <i class="fas fa-triangle-exclamation"></i>
        {{ $t('budgets.exceeded', { percent: Math.round(item.percent * 100) }) }}
      </p>
      <p v-else-if="item.status === 'warning'" class="text-xs mt-1" :class="textColor.warning">
        <i class="fas fa-triangle-exclamation"></i>
        {{ $t('budgets.warning', { percent: Math.round(item.percent * 100) }) }}
      </p>
    </div>
  </div>
</template>
