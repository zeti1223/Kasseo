<script setup>
defineProps({
  group: { type: Object, required: true },
});
defineEmits(["open"]);

function formatCurrency(amount, currency) {
  return `${amount.toFixed(2)} ${currency}`;
}
</script>

<template>
  <div
    class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col cursor-pointer hover:shadow-md transition-shadow"
    @click="$emit('open')"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1">
        <div class="text-lg font-semibold mb-1 font-display dark:text-white">
          {{ group.name }}
        </div>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          {{ group.currency }} • {{ group.memberCount }} member{{
            group.memberCount !== 1 ? "s" : ""
          }}
        </div>
      </div>
      <div class="text-right">
        <div
          class="text-lg font-bold dark:text-white"
          :class="group.balance >= 0 ? 'text-[#A7F49D]' : 'text-[#C1503A]'"
        >
          {{ formatCurrency(group.balance, group.currency) }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          Current balance
        </div>
      </div>
    </div>

    <div class="flex-1" />
    <div class="mt-3">
      <button
        @click.stop="$emit('open')"
        class="w-full text-sm px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
      >
        <i class="fas fa-arrow-right w-4 h-4"></i>
        Open
      </button>
    </div>
  </div>
</template>
