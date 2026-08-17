<script setup>
import StatCard from "../../common/StatCard.vue";

defineProps({
  mode: { type: String, required: true }, // 'kitty' | 'split'
  totals: { type: Object, required: true },
  currency: { type: String, required: true },
});
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
    <template v-if="mode === 'split'">
      <StatCard
        label="Your balance"
        :value="totals.yourBalance"
        :currency="currency"
        :color="totals.yourBalance >= 0 ? 'success' : 'error'"
        icon="piggy-bank"
      />
      <StatCard
        label="You paid"
        :value="totals.youPaid"
        :currency="currency"
        color="primary"
        icon="arrow-up"
      />
      <StatCard
        label="Total spent"
        :value="totals.totalSpent"
        :currency="currency"
        color="warning"
        icon="arrow-up"
      />
    </template>
    <template v-else>
      <StatCard
        label="Current balance"
        :value="totals.balance"
        :currency="currency"
        color="primary"
        icon="piggy-bank"
      />
      <StatCard
        label="Total deposited"
        :value="totals.deposited"
        :currency="currency"
        color="success"
        icon="arrow-down"
      />
      <StatCard
        label="Total spent"
        :value="totals.spent"
        :currency="currency"
        color="error"
        icon="arrow-up"
      />
    </template>
  </div>
</template>
