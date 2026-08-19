<script setup>
import ActivityItem from "./ActivityItem.vue";

defineProps({
  transactions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});
defineEmits(["open"]);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold font-display dark:text-white">
        {{ $t('dashboard.recentActivity') }}
      </h2>
      <span v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('common.loading') }}
      </span>
    </div>

    <div
      class="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"
    >
      <div
        v-if="transactions.length === 0 && !loading"
        class="p-6 text-center text-gray-500 dark:text-gray-400"
      >
        <i class="fas fa-clipboard-list w-8 h-8 mx-auto mb-2 opacity-50"></i>
        {{ $t('dashboard.noRecentActivity') }}
      </div>

      <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <ActivityItem
          v-for="tx in transactions"
          :key="tx.id"
          :tx="tx"
          @open="$emit('open', tx.groupId)"
        />
      </div>
    </div>
  </div>
</template>
