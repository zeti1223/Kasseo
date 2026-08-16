<script setup>
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import { buildMemberBreakdown } from "@/utils/chartData";

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
});
const chartData = computed(() =>
  buildMemberBreakdown(props.transactions, props.members),
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
  scales: { y: { beginAtZero: true } },
};
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
