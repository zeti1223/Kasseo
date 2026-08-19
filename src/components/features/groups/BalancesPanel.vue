<script setup>
import { computed } from "vue";
import { computeSplitBalances } from "@/utils/chartData";

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
  currentUserId: { type: String, default: "" },
  currency: { type: String, default: "" },
});
const emit = defineEmits(["settle"]);

const rows = computed(() => {
  const balances = computeSplitBalances(props.transactions, props.members);
  return Object.entries(props.members || {})
    .map(([id, member]) => ({
      id,
      displayName: member.displayName,
      photoURL: member.photoURL,
      balance: balances[id] || 0,
      isYou: id === props.currentUserId,
    }))
    .sort((a, b) => (a.isYou ? -1 : b.isYou ? 1 : b.balance - a.balance));
});

function amountLabel(balance) {
  if (Math.abs(balance) < 0.005) return "Settled up";
  return balance > 0 ? "is owed" : "owes";
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="row in rows"
      :key="row.id"
      class="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
    >
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div
          v-if="row.photoURL"
          class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
        >
          <img
            :src="row.photoURL"
            :alt="row.displayName"
            class="w-full h-full object-cover"
          />
        </div>
        <div
          v-else
          class="w-8 h-8 rounded-full bg-[#C8A5FC] flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
        >
          {{ row.displayName?.charAt(0).toUpperCase() || "?" }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium dark:text-white truncate">
            {{ row.isYou ? "You" : row.displayName }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ amountLabel(row.balance) }}
          </div>
        </div>
      </div>

      <div class="flex flex-col items-end gap-1 flex-shrink-0">
        <span
          class="font-bold money text-sm"
          :class="
            Math.abs(row.balance) < 0.005
              ? 'text-gray-400 dark:text-gray-500'
              : row.balance > 0
                ? 'text-[#3FA34D] dark:text-[#A7F49D]'
                : 'text-[#C1503A]'
          "
        >
          {{ Math.abs(row.balance).toFixed(2) }} {{ currency }}
        </span>
        <button
          v-if="!row.isYou && Math.abs(row.balance) >= 0.005"
          @click="emit('settle', row.id)"
          class="text-xs px-2 py-0.5 rounded-md bg-[#C8A5FC]/20 hover:bg-[#C8A5FC]/40 text-[#8A5FBF] dark:text-[#C8A5FC] font-medium transition-colors whitespace-nowrap"
        >
          Settle up
        </button>
      </div>
    </div>

    <div
      v-if="!rows.length"
      class="text-sm text-gray-500 dark:text-gray-400 text-center py-4"
    >
      No members yet
    </div>
  </div>
</template>
