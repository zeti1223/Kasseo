<script setup>
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import { buildMonthlyCashFlow } from "@/utils/chartData";
import { cartesianOptions } from "@/utils/chartTheme";

// Deposits vs. expenses per month. Settlements are intentionally left
// out (see buildMonthlyCashFlow) since they don't change the fund total.
const props = defineProps({
  transactions: { type: Array, default: () => [] },
  currency: { type: String, default: "" },
});
const chartData = computed(() => buildMonthlyCashFlow(props.transactions));
const chartOptions = computed(() =>
  cartesianOptions(props.currency, {
    scales: { x: { stacked: false }, y: { beginAtZero: true } },
  }),
);
</script>

<template>
  <div style="height: 260px">
    <Bar v-if="transactions.length" :data="chartData" :options="chartOptions" />
    <div
      v-else
      class="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center h-full"
    >
      No data yet
    </div>
  </div>
</template>
