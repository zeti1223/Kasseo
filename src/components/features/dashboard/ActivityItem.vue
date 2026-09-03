<script setup>
import { getCategoryIcon, getCategoryLabel } from "@/constants/categories";
import { formatCurrency } from "@/utils/format";

defineProps({
  tx: { type: Object, required: true },
});
defineEmits(["open"]);
</script>

<template>
  <div
    class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
    :class="{ 'opacity-60': tx.pending }"
    @click="$emit('open')"
  >
    <div class="flex items-start gap-3">
      <div
        class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        :class="
          tx.type === 'deposit'
            ? 'bg-[#A7F49D]/20'
            : tx.type === 'settlement'
              ? 'bg-[#A5E3FC]/20'
              : 'bg-[#C1503A]/20'
        "
      >
        <i
          :class="[
            'text-xs flex items-center justify-center',
            tx.type === 'deposit'
              ? 'fas fa-arrow-down text-[#A7F49D]'
              : tx.type === 'settlement'
                ? 'fas fa-handshake text-[#A5E3FC]'
                : `${getCategoryIcon(tx.category)} text-[#C1503A]`,
          ]"
        ></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <div class="font-medium text-sm dark:text-white truncate flex items-center gap-1.5">
            <span class="truncate">{{ tx.description || getCategoryLabel(tx.category, $t) }}</span>
            <i
              v-if="tx.pending"
              class="fas fa-rotate text-[10px] text-amber-500 dark:text-amber-400 flex-shrink-0"
              :title="$t('transactions.syncPendingTooltip')"
            ></i>
          </div>
          <div
            class="text-sm font-semibold dark:text-white shrink-0 ml-2 font-mono tabular-nums"
            :class="tx.type === 'deposit' ? 'text-[#A7F49D]' : 'text-[#C1503A]'"
          >
            {{ tx.type === "deposit" ? "+" : "-"
            }}{{ formatCurrency(tx.amount, tx.groupCurrency) }}
          </div>
        </div>
        <div
          class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
        >
          <div class="truncate flex items-center gap-1.5">
            <span>{{ tx.groupName }}</span>
            <span v-if="tx.category && tx.type === 'expense'" class="text-gray-400 dark:text-gray-500">· {{ getCategoryLabel(tx.category, $t) }}</span>
            <span
              v-if="tx.pending"
              class="text-amber-600 dark:text-amber-400 font-medium"
              :title="$t('transactions.syncPendingTooltip')"
            >
              · {{ $t('transactions.syncPending') }}
            </span>
          </div>
          <div>{{ new Date(tx.date).toLocaleDateString() }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
