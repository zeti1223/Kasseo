<script setup>
import { computed } from "vue";
import { Doughnut } from "vue-chartjs";
import { buildCategoryBreakdown } from "@/utils/chartData";
import { radialOptions } from "@/utils/chartTheme";

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  currency: { type: String, default: "" },
});
const chartData = computed(() => buildCategoryBreakdown(props.transactions));
const hasExpenses = computed(() =>
  props.transactions.some((t) => t.type === "expense"),
);
const chartOptions = computed(() => radialOptions(props.currency));

const total = computed(() =>
  props.transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0),
);
</script>

<template>
  <div style="height: 260px" class="relative">
    <Doughnut v-if="hasExpenses" :data="chartData" :options="chartOptions" />
    <div
      v-if="hasExpenses"
      class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
      style="padding-bottom: 34px"
    >
      <span class="text-xs text-gray-500 dark:text-gray-400">Total</span>
      <span class="text-sm font-semibold dark:text-white">
        {{ total.toFixed(2) }} {{ currency }}
      </span>
    </div>
    <div
      v-else
      class="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center h-full"
    >
      No expenses yet
    </div>
  </div>
</template>
