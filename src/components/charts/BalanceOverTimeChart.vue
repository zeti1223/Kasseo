<script setup>
import { computed } from "vue";
import { Line } from "vue-chartjs";
import {
  buildBalanceOverTime,
  buildYourBalanceOverTime,
} from "@/utils/chartData";
import { cartesianOptions } from "@/utils/chartTheme";

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  mode: { type: String, default: "kitty" }, // 'kitty' | 'split'
  members: { type: Object, default: () => ({}) }, // only needed for 'split'
  userId: { type: String, default: "" }, // only needed for 'split'
  currency: { type: String, default: "" },
});
const chartData = computed(() =>
  props.mode === "split"
    ? buildYourBalanceOverTime(props.transactions, props.members, props.userId)
    : buildBalanceOverTime(props.transactions),
);
const chartOptions = computed(() =>
  cartesianOptions(props.currency, { plugins: { legend: { display: false } } }),
);
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
      {{ $t('charts.noData') }}
    </div>
  </div>
</template>
