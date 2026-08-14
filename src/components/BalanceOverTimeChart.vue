<script setup>
import { computed } from "vue";
import { Line } from "vue-chartjs";
import {
  buildBalanceOverTime,
  buildYourBalanceOverTime,
} from "@/utils/chartData";

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  mode: { type: String, default: "kitty" }, // 'kitty' | 'split'
  members: { type: Object, default: () => ({}) }, // only needed for 'split'
  userId: { type: String, default: "" }, // only needed for 'split'
});
const chartData = computed(() =>
  props.mode === "split"
    ? buildYourBalanceOverTime(props.transactions, props.members, props.userId)
    : buildBalanceOverTime(props.transactions),
);
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
};
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
      class="text-body-2 text-medium-emphasis d-flex align-center justify-center h-100"
    >
      No data yet
    </div>
  </div>
</template>
