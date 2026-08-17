<script setup>
defineProps({
  tx: { type: Object, required: true },
});
defineEmits(["open"]);

function formatCurrency(amount, currency) {
  return `${amount.toFixed(2)} ${currency}`;
}
</script>

<template>
  <div
    class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
    @click="$emit('open')"
  >
    <div class="flex items-start gap-3">
      <div
        class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        :class="tx.type === 'deposit' ? 'bg-[#A7F49D]/20' : 'bg-[#C1503A]/20'"
      >
        <i
          :class="[
            'w-4 h-4',
            tx.type === 'deposit'
              ? 'fas fa-arrow-down text-[#A7F49D]'
              : 'fas fa-arrow-up text-[#C1503A]',
          ]"
        ></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <div class="font-medium text-sm dark:text-white truncate">
            {{ tx.description || tx.category }}
          </div>
          <div
            class="text-sm font-semibold dark:text-white"
            :class="tx.type === 'deposit' ? 'text-[#A7F49D]' : 'text-[#C1503A]'"
          >
            {{ tx.type === "deposit" ? "+" : "-"
            }}{{ formatCurrency(tx.amount, tx.groupCurrency) }}
          </div>
        </div>
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div class="truncate">{{ tx.groupName }}</div>
          <div>{{ new Date(tx.date).toLocaleDateString() }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
