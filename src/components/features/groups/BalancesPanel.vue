<script setup>
import { computed, ref } from "vue";
import { useTranslation } from "i18next-vue";
import { computeSplitBalances } from "@/utils/chartData";
import { formatCompactNumber } from "@/utils/format";

const props = defineProps({
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
  currentUserId: { type: String, default: "" },
  currency: { type: String, default: "" },
});
const emit = defineEmits(["settle"]);
const { t } = useTranslation();

const rows = computed(() => {
  const balances = computeSplitBalances(props.transactions, props.members);
  return Object.entries(props.members || {})
    .map(([id, member]) => ({
      id,
      displayName: member.nickname || member.displayName || t("common.someone"),
      photoURL: member.photoURL,
      balance: balances[id] || 0,
      isYou: id === props.currentUserId,
    }))
    .sort((a, b) => (a.isYou ? -1 : b.isYou ? 1 : b.balance - a.balance));
});

// Tracks members whose photoURL failed to load (e.g. transient Google
// avatar errors) so we can fall back to the initials avatar instead of
// leaving a broken image icon.
const failedPhotoIds = ref(new Set());
function onPhotoError(id) {
  failedPhotoIds.value = new Set(failedPhotoIds.value).add(id);
}

function amountLabel(balance) {
  if (Math.abs(balance) < 0.005) return t("groups.settledUp");
  return balance > 0 ? t("groups.isOwed") : t("groups.owes");
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
          v-if="row.photoURL && !failedPhotoIds.has(row.id)"
          class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
        >
          <img
            :src="row.photoURL"
            :alt="row.displayName"
            class="w-full h-full object-cover"
            @error="onPhotoError(row.id)"
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
            {{ row.isYou ? $t('common.you') : row.displayName }}
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
          {{ formatCompactNumber(Math.abs(row.balance)) }} {{ currency }}
        </span>
        <button
          v-if="!row.isYou && Math.abs(row.balance) >= 0.005"
          @click="emit('settle', row.id)"
          class="text-xs px-2 py-0.5 rounded-md bg-[#C8A5FC]/20 hover:bg-[#C8A5FC]/40 text-[#8A5FBF] dark:text-[#C8A5FC] font-medium transition-colors whitespace-nowrap"
        >
          {{ $t('groups.settleUp') }}
        </button>
      </div>
    </div>

    <div
      v-if="!rows.length"
      class="text-sm text-gray-500 dark:text-gray-400 text-center py-4"
    >
      {{ $t('groups.noMembers') }}
    </div>
  </div>
</template>
