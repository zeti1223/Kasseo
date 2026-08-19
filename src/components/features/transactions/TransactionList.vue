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
  return props.members?.[uid]?.displayName || "Someone";
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
    class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
  >
    <div class="flex items-center justify-between mb-3">
      <div class="text-base font-medium font-display dark:text-white">
        Transactions
      </div>
      <button
        v-if="transactions.length"
        @click="$emit('export')"
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-[#C8A5FC] dark:hover:text-[#C8A5FC] flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        title="Export transactions"
      >
        <i class="fas fa-file-export"></i>
        <span>Export</span>
      </button>
    </div>

    <div
      v-if="!transactions.length"
      class="bg-[#A5E3FC]/20 border border-[#A5E3FC] text-[#A5E3FC] rounded-lg p-3"
    >
      No transactions yet — log the first
      {{ mode === "split" ? "expense" : "deposit or expense" }} to get started.
    </div>

    <div v-else class="space-y-3">
      <template v-for="entry in displayEntries" :key="entry.isGroup ? entry.receiptId : entry.tx.id">
        <!-- PRODUCT GROUP (RECEIPT) CARD -->
        <div
          v-if="entry.isGroup"
          class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-gray-800/30"
        >
          <!-- Group Header -->
          <div class="flex items-center gap-3 p-3 bg-white dark:bg-surface-dark border-b border-gray-100 dark:border-gray-700/50">
            <div class="w-9 h-9 rounded-full bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center flex-shrink-0">
              <i class="fas fa-receipt"></i>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start">
                <span class="font-medium truncate dark:text-white flex items-center gap-2">
                  Product group ({{ entry.items.length }} item{{ entry.items.length === 1 ? "" : "s" }})
                </span>
                <span class="font-bold money text-[#C1503A]">
                  -{{ entry.totalAmount.toFixed(2) }}
                </span>
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{{ entry.date }} · <span class="dark:text-gray-300">{{ memberName(entry.paidBy) }}</span></span>

                <div v-if="mode === 'split'" class="inline-flex text-[11px] rounded border border-gray-200 dark:border-gray-600 overflow-hidden ml-1">
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
            </div>

            <div class="flex items-center gap-1 ml-1">
              <button
                @click="toggleGroupExpand(entry.receiptId)"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                :title="isGroupExpanded(entry.receiptId) ? 'Collapse group' : 'Expand group'"
              >
                <i :class="isGroupExpanded(entry.receiptId) ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
              </button>
              <button
                @click="handleDeleteReceiptGroup(entry.receiptId)"
                class="text-gray-400 hover:text-red-500 transition-colors p-1"
                title="Delete product group"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- Group Items -->
          <div v-if="isGroupExpanded(entry.receiptId)" class="divide-y divide-gray-100 dark:divide-gray-700/50">
            <div
              v-for="tx in entry.items"
              :key="tx.id"
              class="flex items-center gap-3 p-2.5 pl-6 hover:bg-gray-100/50 dark:hover:bg-gray-700/30 transition-colors text-sm"
            >
              <div class="w-6 h-6 rounded-full bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center flex-shrink-0 text-xs">
                <i :class="categoryIcon(tx.category)"></i>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                  <span class="font-medium truncate dark:text-white">
                    {{ tx.description || tx.category }}
                  </span>
                  <span class="font-semibold text-xs money text-[#C1503A]">
                    -{{ tx.amount.toFixed(2) }}
                  </span>
                </div>
                <div class="text-xs text-gray-400 dark:text-gray-400">
                  <span class="dark:text-gray-300">{{ tx.category }}</span>
                </div>
                <div
                  v-if="mode === 'split'"
                  class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5"
                >
                  <template v-if="entry.splitOption === 'whole_group'">
                    Split between everyone
                  </template>
                  <template v-else>
                    Split between {{ splitBetweenLabel(tx) }}
                    <span
                      v-if="splitInfo(tx)"
                      class="ml-1 font-medium"
                      :class="{
                        'text-[#3FA34D] dark:text-[#A7F49D]': splitInfo(tx).tone === 'positive',
                        'text-[#C1503A]': splitInfo(tx).tone === 'negative',
                      }"
                    >· {{ splitInfo(tx).text }}</span>
                  </template>
                </div>
              </div>

              <div class="flex items-center gap-1">
                <button
                  @click="handleEdit(tx)"
                  class="text-gray-400 hover:text-[#C8A5FC] transition-colors p-1"
                  :class="{ 'opacity-50': !canEdit(tx) }"
                >
                  <i class="fas fa-edit"></i>
                </button>
                <button
                  @click="handleDelete(tx.id)"
                  class="text-gray-400 hover:text-red-500 transition-colors p-1"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- STANDALONE TRANSACTION -->
        <div
          v-else
          class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div
            :class="
              entry.tx.type === 'deposit'
                ? 'bg-[#A7F49D]'
                : entry.tx.type === 'settlement'
                  ? 'bg-[#A5E3FC]'
                  : 'bg-[#C1503A]'
            "
            class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          >
            <i
              :class="[
                'text-white text-sm',
                entry.tx.type === 'deposit'
                  ? 'fas fa-arrow-down'
                  : entry.tx.type === 'settlement'
                    ? 'fas fa-handshake'
                    : categoryIcon(entry.tx.category),
              ]"
            ></i>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start">
              <span class="font-medium truncate dark:text-white">
                <template v-if="entry.tx.type === 'settlement'">
                  {{ memberName(entry.tx.paidBy) }} paid {{ memberName(entry.tx.to) }}
                </template>
                <template v-else>
                  {{ entry.tx.description || entry.tx.category }}
                </template>
              </span>
              <span
                class="font-bold money dark:text-white"
                :class="
                  entry.tx.type === 'deposit'
                    ? 'text-[#A7F49D]'
                    : entry.tx.type === 'settlement'
                      ? 'text-[#5C7A99] dark:text-[#A5E3FC]'
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
                <span
                  v-if="originalAmountLabel(entry.tx)"
                  class="font-normal text-xs text-gray-400 dark:text-gray-500"
                  >({{ originalAmountLabel(entry.tx) }})</span
                >
              </span>
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              <template v-if="entry.tx.type === 'settlement'">
                {{ entry.tx.date }}{{ entry.tx.description ? ` · ${entry.tx.description}` : "" }}
              </template>
              <template v-else>
                {{ entry.tx.date }} ·
                <span class="dark:text-gray-300">{{
                  memberName(entry.tx.paidBy)
                }}</span>
                · <span class="dark:text-gray-300">{{ entry.tx.category }}</span>
              </template>
            </div>
            <div
              v-if="mode === 'split' && entry.tx.type === 'expense'"
              class="text-xs text-gray-400 dark:text-gray-500 mt-0.5"
            >
              Split between {{ splitBetweenLabel(entry.tx) }}
              <span
                v-if="splitInfo(entry.tx)"
                class="ml-1 font-medium"
                :class="{
                  'text-[#3FA34D] dark:text-[#A7F49D]':
                    splitInfo(entry.tx).tone === 'positive',
                  'text-[#C1503A]': splitInfo(entry.tx).tone === 'negative',
                }"
                >· {{ splitInfo(entry.tx).text }}</span
              >
            </div>
          </div>

          <div class="flex items-center gap-1">
            <button
              @click="handleEdit(entry.tx)"
              class="text-gray-400 hover:text-[#C8A5FC] transition-colors p-1"
              :class="{ 'opacity-50': !canEdit(entry.tx) }"
            >
              <i class="fas fa-edit"></i>
            </button>
            <button
              @click="handleDelete(entry.tx.id)"
              class="text-gray-400 hover:text-red-500 transition-colors p-1"
            >
              <i class="fas fa-trash"></i>
            </button>
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
