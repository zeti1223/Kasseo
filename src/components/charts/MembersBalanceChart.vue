<script setup>
import { computed } from "vue";
import { Line } from "vue-chartjs";
import { buildAllMembersBalanceOverTime } from "@/utils/chartData";
import { cartesianOptions } from "@/utils/chartTheme";

// Split mode only: every member's net balance over time, one line each.
const props = defineProps({
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
  currency: { type: String, default: "" },
});
const chartData = computed(() =>
  buildAllMembersBalanceOverTime(props.transactions, props.members),
);
const chartOptions = computed(() => cartesianOptions(props.currency));
</script>

<template>
  <div style="height: 260px">
    <Line
      v-if="transactions.length"
      :data="chartData"
      :options="chartOptions"
    />
    <div
      v-else
      class="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center h-full"
    >
      {{ $t('common.noData') }}
    </div>
  </div>
</template>
