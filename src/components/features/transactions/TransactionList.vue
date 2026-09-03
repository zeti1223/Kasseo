<script setup>
import { computed, ref } from "vue";
import { useTransactionsStore } from "@/stores/transactions";
import { useGroupsStore, isMemberAdmin } from "@/stores/groups";
import { useAuthStore } from "@/stores/auth";
import { useTranslation } from "i18next-vue";
import { splitShareAmount } from "@/utils/chartData";
import { formatCompactNumber } from "@/utils/format";
import { getCategoryIcon, getCategoryLabel } from "@/constants/categories";
import { filterTransactions } from "@/utils/exportData";
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
const { t } = useTranslation();

const transactionsStore = useTransactionsStore();
const groupsStore = useGroupsStore();
const authStore = useAuthStore();

const isAdmin = computed(() => {
  const uid = authStore.user?.uid;
  if (!uid) return false;
  const currentMember = props.members?.[uid];
  return isMemberAdmin(
    currentMember ? { id: uid, ...currentMember } : null,
    groupsStore.currentGroup?.ownerId,
  );
});

const editingTransaction = ref(null);
const showEditDialog = ref(false);
const permissionTx = ref(null);
const showPermissionAlert = ref(false);

// --- Search & filtering (local state, not persisted) ---
const searchQuery = ref("");
const typeFilter = ref("all"); // 'all' | 'expense' | 'deposit' | 'settlement'
const categoryFilter = ref("all");
const memberFilter = ref("all");
const dateFilter = ref("all"); // 'all' | 'this_month' | 'last_month' | 'this_year' | 'custom'
const startDate = ref("");
const endDate = ref("");
const showFilters = ref(false);

const availableCategories = computed(() => {
  const names = new Set();
  for (const tx of props.transactions) {
    if (tx.category) names.add(tx.category);
  }
  for (const cat of props.customCategories) {
    if (cat.name) names.add(cat.name);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
});

const availableMembers = computed(() => {
  return Object.entries(props.members || {}).map(([id, m]) => ({
    id,
    name: m.nickname || m.displayName || m.email || id,
  }));
});

const hasActiveFilters = computed(() => {
  return (
    searchQuery.value.trim() !== "" ||
    typeFilter.value !== "all" ||
    categoryFilter.value !== "all" ||
    memberFilter.value !== "all" ||
    dateFilter.value !== "all"
  );
});

const filteredTransactions = computed(() => {
  return filterTransactions(props.transactions, {
    search: searchQuery.value,
    typeFilter: typeFilter.value,
    categoryFilter: categoryFilter.value,
    memberFilter: memberFilter.value,
    dateFilter: dateFilter.value,
    startDate: startDate.value,
    endDate: endDate.value,
  });
});

function clearFilters() {
  searchQuery.value = "";
  typeFilter.value = "all";
  categoryFilter.value = "all";
  memberFilter.value = "all";
  dateFilter.value = "all";
  startDate.value = "";
  endDate.value = "";
}

function categoryIcon(catName) {
  const customCat = props.customCategories.find((c) => c.name === catName);
  return getCategoryIcon(catName, customCat?.icon);
}

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

  for (const tx of filteredTransactions.value) {
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
    t("common.someone")
  );
}

function canEdit(tx) {
  if (tx.pending) return false;
  return tx.paidBy === authStore.user?.uid || isAdmin.value;
}

function canDelete(tx) {
  if (tx.pending) return false;
  return tx.paidBy === authStore.user?.uid || isAdmin.value;
}

function canDeleteReceiptGroup(entry) {
  return entry.paidBy === authStore.user?.uid || isAdmin.value;
}

function canChangeReceiptGroupSplit(entry) {
  return entry.paidBy === authStore.user?.uid || isAdmin.value;
}

function handleDelete(txId) {
  const tx = props.transactions.find((t) => t.id === txId);
  if (tx && !canDelete(tx)) return;
  transactionsStore.deleteTransaction(props.groupId, txId);
}

function handleDeleteReceiptGroup(receiptId) {
  const entry = displayEntries.value.find((e) => e.isGroup && e.receiptId === receiptId);
  if (entry && !canDeleteReceiptGroup(entry)) return;
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

function handleEdit(tx) {
  if (tx.pending) return;
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
    if (owedToYou < 0.005) return { text: t("transactions.yourShareOnly"), tone: "muted" };
    return { text: t("transactions.youAreOwed", { amount: formatCompactNumber(owedToYou) }), tone: "positive" };
  }
  return { text: t("transactions.youOwe", { amount: formatCompactNumber(share) }), tone: "negative" };
}

// Small note showing the original amount when it differs from the
// fund's currency.
function originalAmountLabel(tx) {
  if (!tx.originalCurrency || tx.originalCurrency === props.groupCurrency) {
    return null;
  }
  return `${formatCompactNumber(tx.originalAmount)} ${tx.originalCurrency}`;
}

function splitBetweenLabel(tx) {
  const participants = tx.splitAmong?.length
    ? tx.splitAmong
    : Object.keys(props.members);
  const uid = authStore.user?.uid;
  return participants
    .map((id) => {
      const name = id === uid ? t("common.you").toLowerCase() : memberName(id);
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
          {{ $t('transactions.title') }}
        </h3>
        <span
          v-if="transactions.length"
          class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium"
        >
          {{ hasActiveFilters ? $t('transactions.resultsCount', { count: filteredTransactions.length, total: transactions.length }) : transactions.length }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="transactions.length"
          @click="showFilters = !showFilters"
          class="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
          :class="
            showFilters || hasActiveFilters
              ? 'text-[#8A5FBF] dark:text-[#C8A5FC] bg-[#C8A5FC]/10'
              : 'text-gray-500 dark:text-gray-400 hover:text-[#C8A5FC] dark:hover:text-[#C8A5FC] hover:bg-gray-100 dark:hover:bg-gray-700/50'
          "
        >
          <i class="fas fa-filter"></i>
          <span
            v-if="hasActiveFilters"
            class="w-1.5 h-1.5 rounded-full bg-[#C8A5FC]"
          ></span>
        </button>
        <button
          v-if="transactions.length"
          @click="$emit('export')"
          class="text-xs text-gray-500 dark:text-gray-400 hover:text-[#C8A5FC] dark:hover:text-[#C8A5FC] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors font-medium"
          :title="$t('groups.exportTooltip')"
        >
          <i class="fas fa-file-export"></i>
          <span>{{ $t('common.export') }}</span>
        </button>
      </div>
    </div>

    <!-- Search & Filters -->
    <div v-if="transactions.length" class="mb-4">
      <div class="relative">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400"></i>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="$t('transactions.searchPlaceholder')"
          class="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#C8A5FC] focus:border-[#C8A5FC]"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <i class="fas fa-times-circle text-xs"></i>
        </button>
      </div>

      <div v-if="showFilters" class="mt-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 space-y-3">
        <!-- Type chips -->
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            @click="typeFilter = 'all'"
            class="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
            :class="
              typeFilter === 'all'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            "
          >
            {{ $t('export.allTypes') }}
          </button>
          <button
            type="button"
            @click="typeFilter = 'expense'"
            class="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
            :class="
              typeFilter === 'expense'
                ? 'bg-[#C1503A] text-white border-transparent'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            "
          >
            {{ $t('transactions.expense') }}
          </button>
          <button
            v-if="mode === 'kitty'"
            type="button"
            @click="typeFilter = 'deposit'"
            class="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
            :class="
              typeFilter === 'deposit'
                ? 'bg-[#3FA34D] text-white border-transparent'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            "
          >
            {{ $t('transactions.deposit') }}
          </button>
          <button
            v-if="mode === 'split'"
            type="button"
            @click="typeFilter = 'settlement'"
            class="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
            :class="
              typeFilter === 'settlement'
                ? 'bg-[#5C7A99] dark:bg-[#A5E3FC] text-white dark:text-gray-900 border-transparent'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            "
          >
            {{ $t('transactions.settleUp') }}
          </button>
        </div>

        <!-- Category / Member selects -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ $t('transactions.filterByCategory') }}
            </label>
            <select
              v-model="categoryFilter"
              class="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C8A5FC]"
            >
              <option value="all">{{ $t('transactions.allCategories') }}</option>
              <option v-for="cat in availableCategories" :key="cat" :value="cat">
                {{ getCategoryLabel(cat, $t) }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ $t('transactions.filterByMember') }}
            </label>
            <select
              v-model="memberFilter"
              class="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C8A5FC]"
            >
              <option value="all">{{ $t('transactions.allMembers') }}</option>
              <option v-for="m in availableMembers" :key="m.id" :value="m.id">
                {{ m.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Date range chips -->
        <div>
          <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            {{ $t('transactions.filterByDate') }}
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              @click="dateFilter = 'all'"
              class="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
              :class="
                dateFilter === 'all'
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              "
            >
              {{ $t('export.allTime') }}
            </button>
            <button
              type="button"
              @click="dateFilter = 'this_month'"
              class="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
              :class="
                dateFilter === 'this_month'
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              "
            >
              {{ $t('export.thisMonth') }}
            </button>
            <button
              type="button"
              @click="dateFilter = 'last_month'"
              class="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
              :class="
                dateFilter === 'last_month'
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              "
            >
              {{ $t('export.lastMonth') }}
            </button>
            <button
              type="button"
              @click="dateFilter = 'custom'"
              class="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
              :class="
                dateFilter === 'custom'
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              "
            >
              {{ $t('export.custom') }}
            </button>
          </div>

          <div
            v-if="dateFilter === 'custom'"
            class="grid grid-cols-2 gap-2 mt-2"
          >
            <div>
              <label class="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">{{ $t('export.from') }}</label>
              <input
                v-model="startDate"
                type="date"
                class="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C8A5FC]"
              />
            </div>
            <div>
              <label class="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">{{ $t('export.to') }}</label>
              <input
                v-model="endDate"
                type="date"
                class="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C8A5FC]"
              />
            </div>
          </div>
        </div>

        <button
          v-if="hasActiveFilters"
          type="button"
          @click="clearFilters"
          class="text-[11px] text-gray-500 dark:text-gray-400 hover:text-[#C1503A] dark:hover:text-[#C1503A] font-medium flex items-center gap-1"
        >
          <i class="fas fa-times text-[10px]"></i>
          {{ $t('transactions.clearFilters') }}
        </button>
      </div>
    </div>

    <div
      v-if="!transactions.length"
      class="bg-[#A5E3FC]/20 border border-[#A5E3FC]/40 text-[#A5E3FC] rounded-xl p-4 text-center text-sm"
    >
      {{ $t('transactions.emptyPrompt', { action: mode === "split" ? $t('transactions.expense').toLowerCase() : `${$t('transactions.deposit').toLowerCase()} / ${$t('transactions.expense').toLowerCase()}` }) }}
    </div>

    <div
      v-else-if="!filteredTransactions.length"
      class="bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-xl p-6 text-center"
    >
      <i class="fas fa-search text-xl text-gray-300 dark:text-gray-600 mb-2"></i>
      <p class="text-sm font-medium text-gray-600 dark:text-gray-300">
        {{ $t('transactions.noResultsTitle') }}
      </p>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {{ $t('transactions.noResultsBody') }}
      </p>
      <button
        @click="clearFilters"
        class="mt-3 text-xs font-medium text-[#8A5FBF] dark:text-[#C8A5FC] hover:underline"
      >
        {{ $t('transactions.clearFilters') }}
      </button>
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
                    {{ $t('transactions.productGroup', { count: entry.items.length }) }}
                  </span>
                  <span class="font-bold text-sm sm:text-base font-mono tabular-nums text-[#C1503A] flex-shrink-0">
                    -{{ formatCompactNumber(entry.totalAmount) }}
                  </span>
                </div>

                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>{{ entry.date }}</span>
                  <span class="text-gray-300 dark:text-gray-600">·</span>
                  <span class="dark:text-gray-300 font-medium">{{ memberName(entry.paidBy) }}</span>

                  <div v-if="mode === 'split' && canChangeReceiptGroupSplit(entry)" class="inline-flex text-[11px] rounded-md border border-gray-200 dark:border-gray-600 overflow-hidden ml-1">
                    <button
                      type="button"
                      @click="setGroupSplitOption(entry.receiptId, 'whole_group')"
                      class="px-2 py-0.5 transition-colors"
                      :class="entry.splitOption === 'whole_group' ? 'bg-[#C8A5FC] text-white font-medium' : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
                    >
                      {{ $t('transactions.wholeGroup') }}
                    </button>
                    <button
                      type="button"
                      @click="setGroupSplitOption(entry.receiptId, 'per_item')"
                      class="px-2 py-0.5 transition-colors"
                      :class="entry.splitOption === 'per_item' ? 'bg-[#C8A5FC] text-white font-medium' : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
                    >
                      {{ $t('transactions.perProduct') }}
                    </button>
                  </div>
                </div>

                <div class="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-2">
                  <button
                    @click="toggleGroupExpand(entry.receiptId)"
                    class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors font-medium"
                  >
                    <span>{{ isGroupExpanded(entry.receiptId) ? $t('transactions.hideItems') : $t('transactions.showItems') }}</span>
                    <i :class="isGroupExpanded(entry.receiptId) ? 'fas fa-chevron-up text-[10px]' : 'fas fa-chevron-down text-[10px]'"></i>
                  </button>

                  <button
                    v-if="canDeleteReceiptGroup(entry)"
                    @click="handleDeleteReceiptGroup(entry.receiptId)"
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    :title="$t('transactions.deleteProductGroup')"
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
              :class="{ 'opacity-60': tx.pending }"
            >
              <div class="flex items-start gap-3">
                <div class="w-7 h-7 rounded-lg bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center flex-shrink-0 text-xs mt-0.5">
                  <i :class="categoryIcon(tx.category)"></i>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="font-medium text-sm truncate dark:text-white flex items-center gap-1.5">
                      {{ tx.description || getCategoryLabel(tx.category, $t) }}
                      <i
                        v-if="tx.pending"
                        class="fas fa-rotate text-[10px] text-amber-500 dark:text-amber-400"
                        :title="$t('transactions.syncPendingTooltip')"
                      ></i>
                    </span>
                    <span class="font-semibold text-xs sm:text-sm font-mono tabular-nums text-[#C1503A] flex-shrink-0">
                      -{{ formatCompactNumber(tx.amount) }}
                    </span>
                  </div>

                  <div class="text-xs text-gray-400 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                    <span class="dark:text-gray-300">{{ getCategoryLabel(tx.category, $t) }}</span>
                    <template v-if="tx.pending">
                      <span class="text-gray-300 dark:text-gray-600">·</span>
                      <span
                        class="text-amber-600 dark:text-amber-400 font-medium"
                        :title="$t('transactions.syncPendingTooltip')"
                      >
                        {{ $t('transactions.syncPending') }}
                      </span>
                    </template>
                  </div>

                  <div
                    v-if="mode === 'split'"
                    class="text-[11px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap"
                  >
                    <template v-if="entry.splitOption === 'whole_group'">
                      <span>{{ $t('transactions.splitBetweenEveryone') }}</span>
                    </template>
                    <template v-else>
                      <span>{{ $t('transactions.splitColon', { summary: splitBetweenLabel(tx) }) }}</span>
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
                    :class="{ 'opacity-40 cursor-not-allowed': !canEdit(tx) }"
                    :title="tx.pending ? $t('transactions.syncPendingEditBlocked') : $t('transactions.editItem')"
                  >
                    <i class="fas fa-edit text-xs"></i>
                  </button>
                  <button
                    v-if="canDelete(tx)"
                    @click="handleDelete(tx.id)"
                    class="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    :title="$t('transactions.deleteItem')"
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
          :class="{ 'opacity-60': entry.tx.pending }"
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
                <span class="font-semibold text-sm text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                  <template v-if="entry.tx.type === 'settlement'">
                    {{ $t('transactions.paidTo', { payer: memberName(entry.tx.paidBy), recipient: memberName(entry.tx.to) }) }}
                  </template>
                  <template v-else>
                    {{ entry.tx.description || getCategoryLabel(entry.tx.category, $t) }}
                  </template>
                  <i
                    v-if="entry.tx.pending"
                    class="fas fa-rotate text-[10px] text-amber-500 dark:text-amber-400 flex-shrink-0"
                    :title="$t('transactions.syncPendingTooltip')"
                  ></i>
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
                    }}{{ formatCompactNumber(entry.tx.amount) }}
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
                    <span class="dark:text-gray-300">{{ getCategoryLabel(entry.tx.category, $t) }}</span>
                  </template>
                </template>
                <template v-if="entry.tx.pending">
                  <span class="text-gray-300 dark:text-gray-600">·</span>
                  <span
                    class="text-amber-600 dark:text-amber-400 font-medium"
                    :title="$t('transactions.syncPendingTooltip')"
                  >
                    {{ $t('transactions.syncPending') }}
                  </span>
                </template>
              </div>

              <!-- Row 3: Split info and Actions -->
              <div class="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-2 flex-wrap">
                <div
                  v-if="mode === 'split' && entry.tx.type === 'expense'"
                  class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap"
                >
                  <span class="truncate max-w-[180px] sm:max-w-xs">
                    {{ $t('transactions.splitColon', { summary: splitBetweenLabel(entry.tx) }) }}
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
                    :class="{ 'opacity-40 cursor-not-allowed': !canEdit(entry.tx) }"
                    :title="entry.tx.pending ? $t('transactions.syncPendingEditBlocked') : $t('transactions.editTransaction')"
                  >
                    <i class="fas fa-edit text-xs"></i>
                  </button>
                  <button
                    v-if="canDelete(entry.tx)"
                    @click="handleDelete(entry.tx.id)"
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    :title="$t('transactions.deleteTransaction')"
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
      :title="$t('transactions.permissionRequiredTitle')"
      :confirm-label="$t('transactions.permissionRequiredGotIt')"
      :show-cancel="false"
      @confirm="showPermissionAlert = false"
    >
      <p class="mb-3">
        {{ $t('transactions.permissionRequiredBody', { name: memberName(permissionTx?.paidBy) }) }}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ $t('transactions.permissionRequiredHelp', { name: memberName(permissionTx?.paidBy) }) }}
      </p>
    </ConfirmDialog>
  </div>
</template>
