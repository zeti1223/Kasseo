<script setup>
import { computed } from "vue";
import { Doughnut } from "vue-chartjs";
import { buildCategoryBreakdown } from "@/utils/chartData";

const props = defineProps({ transactions: { type: Array, default: () => [] } });
const chartData = computed(() => buildCategoryBreakdown(props.transactions));
const hasExpenses = computed(() =>
  props.transactions.some((t) => t.type === "expense"),
);
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: { boxWidth: 12, font: { size: 11 } },
    },
  },
};
</script>

<template>
  <div style="height: 260px">
    <Doughnut v-if="hasExpenses" :data="chartData" :options="chartOptions" />
    <div
      v-else
      class="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center h-full"
    >
      No expenses yet
    </div>
  </div>
</template>
