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
    <div
      v-for="item in progress"
      :key="item.key"
      class="group"
    >
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2 min-w-0">
          <div
            class="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 text-xs text-gray-500 dark:text-gray-400"
          >
            <i :class="getCategoryIcon(item.name, item.icon)"></i>
          </div>
          <span class="text-sm font-medium dark:text-white truncate">
            {{ label(item) }}
          </span>
          <span
            v-if="item.rollover"
            :title="$t('fundSettings.budgetRollover')"
            class="inline-flex items-center gap-1 text-[10px] text-[#8A5FBF] dark:text-[#C8A5FC] bg-[#C8A5FC]/15 dark:bg-[#C8A5FC]/20 px-1.5 py-0.5 rounded font-medium shrink-0"
          >
            <i class="fas fa-arrows-rotate text-[9px]"></i>
          </span>
        </div>

        <div class="text-right shrink-0 ml-2">
          <span class="text-xs font-semibold" :class="textColor[item.status]">
            {{ formatCurrency(item.spend, currency) }}
          </span>
          <span class="text-xs text-gray-400 dark:text-gray-500 font-normal">
            / {{ formatCurrency(item.limit, currency) }}
          </span>
        </div>
      </div>

      <div class="w-full h-2.5 bg-gray-100 dark:bg-gray-700/80 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500 ease-out"
          :class="barColor[item.status]"
          :style="{ width: `${Math.min(100, item.percent * 100)}%` }"
        ></div>
      </div>

      <div
        v-if="(item.rollover && Math.abs(item.rolloverAmount) >= 0.01) || item.status !== 'ok'"
        class="mt-1.5 flex flex-wrap items-center gap-2 text-xs"
      >
        <span
          v-if="item.status === 'exceeded'"
          class="inline-flex items-center gap-1 font-medium"
          :class="textColor.exceeded"
        >
          <i class="fas fa-triangle-exclamation text-[11px]"></i>
          {{ $t('budgets.exceeded', { percent: Math.round(item.percent * 100) }) }}
        </span>
        <span
          v-else-if="item.status === 'warning'"
          class="inline-flex items-center gap-1 font-medium"
          :class="textColor.warning"
        >
          <i class="fas fa-triangle-exclamation text-[11px]"></i>
          {{ $t('budgets.warning', { percent: Math.round(item.percent * 100) }) }}
        </span>

        <span
          v-if="item.rollover && Math.abs(item.rolloverAmount) >= 0.01"
          class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ml-auto"
          :class="
            item.rolloverAmount > 0
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40'
          "
        >
          <i
            :class="
              item.rolloverAmount > 0
                ? 'fas fa-arrow-trend-up text-emerald-500 dark:text-emerald-400'
                : 'fas fa-arrow-trend-down text-amber-500 dark:text-amber-400'
            "
            class="text-[10px]"
          ></i>
          {{
            item.rolloverAmount > 0
              ? $t('budgets.rolloverCredit', { amount: formatCurrency(item.rolloverAmount, currency) })
              : $t('budgets.rolloverDebit', { amount: formatCurrency(Math.abs(item.rolloverAmount), currency) })
          }}
        </span>
      </div>
    </div>
  </div>
</template>
