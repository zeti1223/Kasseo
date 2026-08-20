<script setup>
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import { buildMemberBreakdown } from "@/utils/chartData";
import { cartesianOptions } from "@/utils/chartTheme";

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
  currency: { type: String, default: "" },
});
const chartData = computed(() =>
  buildMemberBreakdown(props.transactions, props.members),
);
const chartOptions = computed(() =>
  cartesianOptions(props.currency, { scales: { y: { beginAtZero: true } } }),
);
</script>

<template>
  <div style="height: 260px">
    <Bar v-if="transactions.length" :data="chartData" :options="chartOptions" />
    <div
      v-else
      class="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center h-full"
    >
      {{ $t('common.noData') }}
    </div>
  </div>
</template>
