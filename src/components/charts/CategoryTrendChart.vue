<script setup>
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import { buildCategoryTrend } from "@/utils/chartData";
import { cartesianOptions } from "@/utils/chartTheme";

// Stacked spending-by-category, per month — shows how the mix shifts
// over time instead of just an all-time total (see CategoryBreakdownChart
// for that).
const props = defineProps({
  transactions: { type: Array, default: () => [] },
  currency: { type: String, default: "" },
});
const chartData = computed(() => buildCategoryTrend(props.transactions));
const hasExpenses = computed(() =>
  props.transactions.some((t) => t.type === "expense"),
);
const chartOptions = computed(() =>
  cartesianOptions(props.currency, {
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
  }),
);
</script>

<template>
  <div style="height: 260px">
    <Bar v-if="hasExpenses" :data="chartData" :options="chartOptions" />
    <div
      v-else
      class="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center h-full"
    >
      No expenses yet
    </div>
  </div>
</template>
