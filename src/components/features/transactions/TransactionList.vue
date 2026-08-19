<script setup>
import { computed, ref } from "vue";
import { useTransactionsStore } from "@/stores/transactions";
import { useAuthStore } from "@/stores/auth";
import { splitShareAmount } from "@/utils/chartData";
import { getCategoryIcon } from "@/constants/categories";
import EditTransactionDialog from "./EditTransactionDialog.vue";
import ConfirmDialog from "../../common/ConfirmDialog.vue";

const props = defineProps({
  groupId: { type: String, required: true },
  groupCurrency: { type: String, required: true },
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
  customCategories: { type: Array, default: () => [] },
  mode: { type: String, default: "kitty" }, // 'kitty' | 'split'
});

const emit = defineEmits(["export"]);

const editingTransaction = ref(null);
const showEditDialog = ref(false);
const permissionTx = ref(null);
const showPermissionAlert = ref(false);

function categoryIcon(catName) {
  const customCat = props.customCategories.find((c) => c.name === catName);
  return getCategoryIcon(catName, customCat?.icon);
}
const transactionsStore = useTransactionsStore();
const authStore = useAuthStore();

const expandedGroups = ref({});

function toggleGroupExpand(receiptId) {
  expandedGroups.value[receiptId] = !expandedGroups.value[receiptId];
}

function isGroupExpanded(receiptId) {
  return expandedGroups.value[receiptId] !== false; // Default expanded
}

const displayEntries = computed(() => {
  const map = new Map();
  const list = [];

  for (const tx of props.transactions) {
    if (tx.receiptId) {
      if (!map.has(tx.receiptId)) {
        const groupEntry = {
          isGroup: true,
          receiptId: tx.receiptId,
          items: [],
          totalAmount: 0,
          date: tx.date,
          paidBy: tx.paidBy,
          splitOption: tx.splitOption || "whole_group",
        };
        map.set(tx.receiptId, groupEntry);
        list.push(groupEntry);
      }
      const groupEntry = map.get(tx.receiptId);
      groupEntry.items.push(tx);
      groupEntry.totalAmount += Number(tx.amount) || 0;
      if (tx.splitOption) groupEntry.splitOption = tx.splitOption;
    } else {
      list.push({
        isGroup: false,
        tx,
        date: tx.date,
      });
    }
  }

  return list.reverse();
});

function memberName(uid) {
  return (
    props.members?.[uid]?.nickname ||
    props.members?.[uid]?.displayName ||
    "Someone"
  );
}

function handleDelete(txId) {
  transactionsStore.deleteTransaction(props.groupId, txId);
}

function handleDeleteReceiptGroup(receiptId) {
  transactionsStore.deleteReceiptGroup(props.groupId, receiptId);
}

function setGroupSplitOption(receiptId, newSplitOption) {
  transactionsStore.updateReceiptGroupSplitOption(
    props.groupId,
    receiptId,
    newSplitOption,
    props.members,
  );
}

function canEdit(tx) {
  return tx.paidBy === authStore.user?.uid;
}

function handleEdit(tx) {
  if (canEdit(tx)) {
    editingTransaction.value = tx;
    showEditDialog.value = true;
  } else {
    permissionTx.value = tx;
    showPermissionAlert.value = true;
  }
}

// Split-mode context, e.g. "You owe 5.00" or "You're owed 10.00".
function splitInfo(tx) {
  if (props.mode !== "split" || tx.type !== "expense") return null;
  const uid = authStore.user?.uid;
  if (!uid) return null;
  const participants = tx.splitAmong?.length
    ? tx.splitAmong
    : Object.keys(props.members);
  if (!participants.includes(uid)) return null;

  const share = splitShareAmount(tx, uid, participants);
  if (tx.paidBy === uid) {
    const owedToYou = tx.amount - share;
    if (owedToYou < 0.005) return { text: "Your share only", tone: "muted" };
    return { text: `You're owed ${owedToYou.toFixed(2)}`, tone: "positive" };
  }
  return { text: `You owe ${share.toFixed(2)}`, tone: "negative" };
}

// Small note showing the original amount when it differs from the
// fund's currency.
function originalAmountLabel(tx) {
  if (!tx.originalCurrency || tx.originalCurrency === props.groupCurrency) {
    return null;
  }
  return `${tx.originalAmount.toFixed(2)} ${tx.originalCurrency}`;
}

function splitBetweenLabel(tx) {
  const participants = tx.splitAmong?.length
    ? tx.splitAmong
    : Object.keys(props.members);
  const uid = authStore.user?.uid;
  return participants
    .map((id) => {
      const name = id === uid ? "you" : memberName(id);
      if (tx.splitType === "percent" && tx.splitShares) {
        const pct = Number(tx.splitShares[id] || 0);
        return `${name} (${pct}%)`;
      }
      return name;
    })
    .join(", ");
}
</script>

<template>
  <div
    class="bg-white dark:bg-surface-dark rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700"
  >
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <h3 class="text-base font-semibold font-display dark:text-white">
          Transactions
        </h3>
        <span
          v-if="transactions.length"
          class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium"
        >
          {{ transactions.length }}
        </span>
      </div>
      <button
        v-if="transactions.length"
        @click="$emit('export')"
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-[#C8A5FC] dark:hover:text-[#C8A5FC] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors font-medium"
        title="Export transactions"
      >
        <i class="fas fa-file-export"></i>
        <span>Export</span>
      </button>
    </div>

    <div
      v-if="!transactions.length"
      class="bg-[#A5E3FC]/20 border border-[#A5E3FC]/40 text-[#A5E3FC] rounded-xl p-4 text-center text-sm"
    >
      No transactions yet — log the first
      {{ mode === "split" ? "expense" : "deposit or expense" }} to get started.
    </div>

    <div v-else class="space-y-3">
      <template v-for="entry in displayEntries" :key="entry.isGroup ? entry.receiptId : entry.tx.id">
        <!-- PRODUCT GROUP (RECEIPT) CARD -->
        <div
          v-if="entry.isGroup"
          class="border border-gray-200/80 dark:border-gray-700/80 rounded-xl overflow-hidden bg-gray-50/30 dark:bg-surface-dark shadow-xs"
        >
          <!-- Group Header -->
          <div class="p-3 sm:p-3.5 bg-white dark:bg-surface-dark border-b border-gray-100 dark:border-gray-700/50">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center flex-shrink-0 mt-0.5">
                <i class="fas fa-receipt text-sm"></i>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="font-semibold text-sm dark:text-white truncate">
                    Product group ({{ entry.items.length }} item{{ entry.items.length === 1 ? "" : "s" }})
                  </span>
                  <span class="font-bold text-sm sm:text-base font-mono tabular-nums text-[#C1503A] flex-shrink-0">
                    -{{ entry.totalAmount.toFixed(2) }}
                  </span>
                </div>

                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>{{ entry.date }}</span>
                  <span class="text-gray-300 dark:text-gray-600">·</span>
                  <span class="dark:text-gray-300 font-medium">{{ memberName(entry.paidBy) }}</span>

                  <div v-if="mode === 'split'" class="inline-flex text-[11px] rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden ml-1">
                    <button
                      type="button"
                      @click="setGroupSplitOption(entry.receiptId, 'whole_group')"
                      class="px-2 py-0.5 transition-colors"
                      :class="entry.splitOption === 'whole_group' ? 'bg-[#C8A5FC] text-white font-medium' : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
                    >
                      Whole group
                    </button>
                    <button
                      type="button"
                      @click="setGroupSplitOption(entry.receiptId, 'per_item')"
                      class="px-2 py-0.5 transition-colors"
                      :class="entry.splitOption === 'per_item' ? 'bg-[#C8A5FC] text-white font-medium' : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
                    >
                      Per product
                    </button>
                  </div>
                </div>

                <div class="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-2">
                  <button
                    @click="toggleGroupExpand(entry.receiptId)"
                    class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors font-medium"
                  >
                    <span>{{ isGroupExpanded(entry.receiptId) ? 'Hide' : 'Show' }} items</span>
                    <i :class="isGroupExpanded(entry.receiptId) ? 'fas fa-chevron-up text-[10px]' : 'fas fa-chevron-down text-[10px]'"></i>
                  </button>

                  <button
                    @click="handleDeleteReceiptGroup(entry.receiptId)"
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete product group"
                  >
                    <i class="fas fa-trash text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Group Items -->
          <div v-if="isGroupExpanded(entry.receiptId)" class="divide-y divide-gray-100 dark:divide-gray-700/40 bg-gray-50/20 dark:bg-gray-850/30">
            <div
              v-for="tx in entry.items"
              :key="tx.id"
              class="p-2.5 sm:p-3 pl-4 sm:pl-6 hover:bg-gray-100/50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div class="flex items-start gap-3">
                <div class="w-7 h-7 rounded-lg bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center flex-shrink-0 text-xs mt-0.5">
                  <i :class="categoryIcon(tx.category)"></i>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="font-medium text-sm truncate dark:text-white">
                      {{ tx.description || tx.category }}
                    </span>
                    <span class="font-semibold text-xs sm:text-sm font-mono tabular-nums text-[#C1503A] flex-shrink-0">
                      -{{ tx.amount.toFixed(2) }}
                    </span>
                  </div>

                  <div class="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                    <span class="dark:text-gray-300">{{ tx.category }}</span>
                  </div>

                  <div
                    v-if="mode === 'split'"
                    class="text-[11px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap"
                  >
                    <template v-if="entry.splitOption === 'whole_group'">
                      <span>Split between everyone</span>
                    </template>
                    <template v-else>
                      <span>Split: {{ splitBetweenLabel(tx) }}</span>
                      <span
                        v-if="splitInfo(tx)"
                        class="font-medium px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap"
                        :class="{
                          'bg-emerald-500/15 text-emerald-600 dark:text-[#A7F49D]': splitInfo(tx).tone === 'positive',
                          'bg-rose-500/15 text-rose-600 dark:text-[#C1503A]': splitInfo(tx).tone === 'negative',
                        }"
                      >
                        {{ splitInfo(tx).text }}
                      </span>
                    </template>
                  </div>
                </div>

                <div class="flex items-center gap-1 flex-shrink-0 self-center sm:self-start">
                  <button
                    @click="handleEdit(tx)"
                    class="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-[#C8A5FC] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    :class="{ 'opacity-40': !canEdit(tx) }"
                    title="Edit item"
                  >
                    <i class="fas fa-edit text-xs"></i>
                  </button>
                  <button
                    @click="handleDelete(tx.id)"
                    class="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete item"
                  >
                    <i class="fas fa-trash text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- STANDALONE TRANSACTION -->
        <div
          v-else
          class="p-3 sm:p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50/40 dark:bg-surface-dark hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors shadow-xs"
        >
          <div class="flex items-start gap-3">
            <!-- Type / Category Icon -->
            <div
              :class="
                entry.tx.type === 'deposit'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-[#A7F49D]'
                  : entry.tx.type === 'settlement'
                    ? 'bg-sky-500/15 text-sky-600 dark:text-[#A5E3FC]'
                    : 'bg-rose-500/15 text-[#C1503A]'
              "
              class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            >
              <i
                :class="[
                  'text-sm',
                  entry.tx.type === 'deposit'
                    ? 'fas fa-arrow-down'
                    : entry.tx.type === 'settlement'
                      ? 'fas fa-handshake'
                      : categoryIcon(entry.tx.category),
                ]"
              ></i>
            </div>

            <!-- Content Area -->
            <div class="flex-1 min-w-0">
              <!-- Row 1: Title & Amount -->
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-semibold text-sm text-gray-900 dark:text-white truncate">
                  <template v-if="entry.tx.type === 'settlement'">
                    {{ memberName(entry.tx.paidBy) }} paid {{ memberName(entry.tx.to) }}
                  </template>
                  <template v-else>
                    {{ entry.tx.description || entry.tx.category }}
                  </template>
                </span>

                <!-- Amount Block with Dedicated Right-Aligned Currency Display -->
                <div class="flex-shrink-0 text-right">
                  <span
                    class="font-bold text-sm sm:text-base font-mono tabular-nums tracking-tight"
                    :class="
                      entry.tx.type === 'deposit'
                        ? 'text-emerald-600 dark:text-[#A7F49D]'
                        : entry.tx.type === 'settlement'
                          ? 'text-sky-600 dark:text-[#A5E3FC]'
                          : 'text-[#C1503A]'
                    "
                  >
                    {{
                      entry.tx.type === "deposit"
                        ? "+"
                        : entry.tx.type === "settlement"
                          ? ""
                          : "-"
                    }}{{ entry.tx.amount.toFixed(2) }}
                  </span>
                  <div
                    v-if="originalAmountLabel(entry.tx)"
                    class="text-[11px] text-gray-400 dark:text-gray-500 font-normal leading-tight mt-0.5 text-right whitespace-nowrap"
                  >
                    ({{ originalAmountLabel(entry.tx) }})
                  </div>
                </div>
              </div>

              <!-- Row 2: Metadata (Date · Paid by · Category) -->
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                <template v-if="entry.tx.type === 'settlement'">
                  <span>{{ entry.tx.date }}</span>
                  <template v-if="entry.tx.description">
                    <span class="text-gray-300 dark:text-gray-600">·</span>
                    <span class="dark:text-gray-300">{{ entry.tx.description }}</span>
                  </template>
                </template>
                <template v-else>
                  <span>{{ entry.tx.date }}</span>
                  <span class="text-gray-300 dark:text-gray-600">·</span>
                  <span class="dark:text-gray-300 font-medium">{{ memberName(entry.tx.paidBy) }}</span>
                  <template v-if="entry.tx.category">
                    <span class="text-gray-300 dark:text-gray-600">·</span>
                    <span class="dark:text-gray-300">{{ entry.tx.category }}</span>
                  </template>
                </template>
              </div>

              <!-- Row 3: Split info and Actions -->
              <div class="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-2 flex-wrap">
                <div
                  v-if="mode === 'split' && entry.tx.type === 'expense'"
                  class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap"
                >
                  <span class="truncate max-w-[180px] sm:max-w-xs">
                    Split: {{ splitBetweenLabel(entry.tx) }}
                  </span>
                  <span
                    v-if="splitInfo(entry.tx)"
                    class="font-medium px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap"
                    :class="{
                      'bg-emerald-500/15 text-emerald-600 dark:text-[#A7F49D]': splitInfo(entry.tx).tone === 'positive',
                      'bg-rose-500/15 text-rose-600 dark:text-[#C1503A]': splitInfo(entry.tx).tone === 'negative',
                      'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400': splitInfo(entry.tx).tone === 'muted',
                    }"
                  >
                    {{ splitInfo(entry.tx).text }}
                  </span>
                </div>
                <div v-else class="text-[11px] text-gray-400"></div>

                <!-- Action buttons -->
                <div class="flex items-center gap-1 ml-auto">
                  <button
                    @click="handleEdit(entry.tx)"
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#C8A5FC] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    :class="{ 'opacity-40': !canEdit(entry.tx) }"
                    title="Edit transaction"
                  >
                    <i class="fas fa-edit text-xs"></i>
                  </button>
                  <button
                    @click="handleDelete(entry.tx.id)"
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete transaction"
                  >
                    <i class="fas fa-trash text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <EditTransactionDialog
      v-model="showEditDialog"
      :transaction="editingTransaction"
      :group-id="groupId"
      :group-currency="groupCurrency"
      :custom-categories="customCategories"
      :mode="mode"
      :members="members"
      :current-user-id="authStore.user?.uid"
    />

    <!-- Permission Alert Dialog -->
    <ConfirmDialog
      v-model="showPermissionAlert"
      title="Permission Required"
      confirm-label="Got it"
      :show-cancel="false"
      @confirm="showPermissionAlert = false"
    >
      <p class="mb-3">
        You can only edit transactions you created. This transaction was created
        by <strong>{{ memberName(permissionTx?.paidBy) }}</strong
        >.
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        If you need to edit this transaction, please ask
        {{ memberName(permissionTx?.paidBy) }} to make the changes or contact
        your group administrator.
      </p>
    </ConfirmDialog>
  </div>
</template>
