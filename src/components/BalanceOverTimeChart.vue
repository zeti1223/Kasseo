<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { buildBalanceOverTime } from '@/utils/chartData'

const props = defineProps({ transactions: { type: Array, default: () => [] } })
const chartData = computed(() => buildBalanceOverTime(props.transactions))
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
}
</script>

<template>
  <div style="height: 260px">
    <Line v-if="transactions.length" :data="chartData" :options="chartOptions" />
    <div v-else class="text-body-2 text-medium-emphasis d-flex align-center justify-center h-100">
      No data yet
    </div>
  </div>
</template>
