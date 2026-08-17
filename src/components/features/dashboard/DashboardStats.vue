<script setup>
import StatCard from "../../common/StatCard.vue";

defineProps({
  totalBalance: { type: Number, required: true },
  totalDeposited: { type: Number, required: true },
  totalSpent: { type: Number, required: true },
  currency: { type: String, required: true },
});
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
    <StatCard
      label="Total balance across all funds"
      :value="totalBalance"
      :currency="currency"
      color="primary"
      icon="piggy-bank"
    />
    <StatCard
      label="Total deposited"
      :value="totalDeposited"
      :currency="currency"
      color="success"
      icon="arrow-down"
    />
    <StatCard
      label="Total spent"
      :value="totalSpent"
      :currency="currency"
      color="error"
      icon="arrow-up"
    />
  </div>
</template>
