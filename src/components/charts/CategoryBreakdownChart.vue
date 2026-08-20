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
</script>

<template>
  <div style="height: 260px" class="relative">
    <Doughnut v-if="hasExpenses" :data="chartData" :options="chartOptions" />
    <div
      v-else
      class="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center h-full"
    >
      {{ $t('charts.noExpenses') }}
    </div>
  </div>
</template>
