<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { buildMemberBreakdown } from '@/utils/chartData'

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
})
const chartData = computed(() => buildMemberBreakdown(props.transactions, props.members))
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
  scales: { y: { beginAtZero: true } },
}
</script>

<template>
  <div style="height: 260px">
    <Bar v-if="transactions.length" :data="chartData" :options="chartOptions" />
    <div v-else class="text-body-2 text-medium-emphasis d-flex align-center justify-center h-100">
      No data yet
    </div>
  </div>
</template>
