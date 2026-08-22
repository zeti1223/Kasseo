<script setup>
import { ref, computed } from "vue";
import {
  filterTransactions,
  exportTransactionsToCSV,
  exportGroupToJSON,
} from "@/utils/exportData";
import { formatCompactNumber } from "@/utils/format";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  group: { type: Object, default: () => ({}) },
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
  customCategories: { type: Array, default: () => [] },
  mode: { type: String, default: "kitty" },
});

const emit = defineEmits(["update:modelValue"]);

const exportFormat = ref("csv"); // 'csv' | 'json'
const dateFilter = ref("all"); // 'all' | 'this_month' | 'last_month' | 'this_year' | 'custom'
const startDate = ref("");
const endDate = ref("");
const typeFilter = ref("all"); // 'all' | 'expense' | 'deposit' | 'settlement'
const isExporting = ref(false);
const exportSuccess = ref(false);

const filteredTransactions = computed(() => {
  return filterTransactions(props.transactions, {
    dateFilter: dateFilter.value,
    startDate: startDate.value,
    endDate: endDate.value,
    typeFilter: typeFilter.value,
  });
});

const totalAmount = computed(() => {
  return filteredTransactions.value.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0,
  );
});

function close() {
  emit("update:modelValue", false);
  exportSuccess.value = false;
}

function handleExport() {
  isExporting.value = true;
  try {
    if (exportFormat.value === "csv") {
      exportTransactionsToCSV(
        props.group,
        filteredTransactions.value,
        props.members,
      );
    } else {
      exportGroupToJSON(
        props.group,
        filteredTransactions.value,
        props.members,
        props.customCategories,
      );
    }
    exportSuccess.value = true;
    setTimeout(() => {
      exportSuccess.value = false;
      close();
    }, 1200);
  } catch (err) {
    console.error("Export failed:", err);
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center"
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50" @click="close" />

    <!-- Modal Content -->
    <div
      class="relative bg-white dark:bg-surface-dark rounded-xl shadow-xl p-6 w-full max-w-[520px] mx-4 max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700"
    >
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2.5">
          <div
            class="w-9 h-9 rounded-lg bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center text-base"
          >
            <i class="fas fa-file-export"></i>
          </div>
          <div>
            <h2 class="text-lg font-bold font-display dark:text-white">
              {{ $t('export.title') }}
            </h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ $t('export.subtitle') }}
            </p>
          </div>
        </div>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="space-y-4">
        <!-- Format Selection -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
            {{ $t('export.fileFormat') }}
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              @click="exportFormat = 'csv'"
              class="flex flex-col items-start p-3 rounded-lg border text-left transition-all"
              :class="
                exportFormat === 'csv'
                  ? 'border-[#C8A5FC] bg-[#C8A5FC]/10 ring-2 ring-[#C8A5FC]/30'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              <div class="flex items-center gap-2 mb-1">
                <i class="fas fa-file-csv text-base text-[#3FA34D]"></i>
                <span class="font-semibold text-sm dark:text-white">CSV</span>
              </div>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('export.csvSubtitle') }}
              </span>
            </button>

            <button
              type="button"
              @click="exportFormat = 'json'"
              class="flex flex-col items-start p-3 rounded-lg border text-left transition-all"
              :class="
                exportFormat === 'json'
                  ? 'border-[#C8A5FC] bg-[#C8A5FC]/10 ring-2 ring-[#C8A5FC]/30'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              <div class="flex items-center gap-2 mb-1">
                <i class="fas fa-file-code text-base text-[#C8A5FC]"></i>
                <span class="font-semibold text-sm dark:text-white">JSON</span>
              </div>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('export.jsonSubtitle') }}
              </span>
            </button>
          </div>
        </div>

        <!-- Date Range Filter -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
            {{ $t('export.timePeriod') }}
          </label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <button
              type="button"
              @click="dateFilter = 'all'"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center"
              :class="
                dateFilter === 'all'
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              {{ $t('export.allTime') }}
            </button>
            <button
              type="button"
              @click="dateFilter = 'this_month'"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center"
              :class="
                dateFilter === 'this_month'
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              {{ $t('export.thisMonth') }}
            </button>
            <button
              type="button"
              @click="dateFilter = 'last_month'"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center"
              :class="
                dateFilter === 'last_month'
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              {{ $t('export.lastMonth') }}
            </button>
            <button
              type="button"
              @click="dateFilter = 'custom'"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center"
              :class="
                dateFilter === 'custom'
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              {{ $t('export.custom') }}
            </button>
          </div>

          <!-- Custom Date Range Inputs -->
          <div
            v-if="dateFilter === 'custom'"
            class="grid grid-cols-2 gap-3 mt-2 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-100 dark:border-gray-700"
          >
            <div>
              <label class="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">{{ $t('export.from') }}</label>
              <input
                v-model="startDate"
                type="date"
                class="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C8A5FC]"
              />
            </div>
            <div>
              <label class="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">{{ $t('export.to') }}</label>
              <input
                v-model="endDate"
                type="date"
                class="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C8A5FC]"
              />
            </div>
          </div>
        </div>

        <!-- Transaction Type Filter -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
            {{ $t('export.transactionType') }}
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              @click="typeFilter = 'all'"
              class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
              :class="
                typeFilter === 'all'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              {{ $t('export.allTypes') }}
            </button>
            <button
              type="button"
              @click="typeFilter = 'expense'"
              class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
              :class="
                typeFilter === 'expense'
                  ? 'bg-[#C1503A] text-white border-transparent'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              {{ $t('transactions.expense') }}
            </button>
            <button
              v-if="mode === 'kitty'"
              type="button"
              @click="typeFilter = 'deposit'"
              class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
              :class="
                typeFilter === 'deposit'
                  ? 'bg-[#3FA34D] text-white border-transparent'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              {{ $t('transactions.deposit') }}
            </button>
            <button
              v-if="mode === 'split'"
              type="button"
              @click="typeFilter = 'settlement'"
              class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
              :class="
                typeFilter === 'settlement'
                  ? 'bg-[#5C7A99] dark:bg-[#A5E3FC] text-white dark:text-gray-900 border-transparent'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              "
            >
              {{ $t('transactions.settleUp') }}
            </button>
          </div>
        </div>

        <!-- Export Summary Box -->
        <div
          class="bg-gray-50 dark:bg-gray-800/80 rounded-lg p-3.5 border border-gray-100 dark:border-gray-700 flex items-center justify-between"
        >
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('export.transactionsToExport') }}</div>
            <div class="text-base font-bold text-gray-800 dark:text-white">
              {{ filteredTransactions.length }}
              <span class="text-xs font-normal text-gray-500">{{ $t('export.itemsCount', { count: filteredTransactions.length }) }}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('export.totalVolume') }}</div>
            <div class="text-base font-bold money text-gray-800 dark:text-white">
              {{ formatCompactNumber(totalAmount) }} {{ group?.currency || "" }}
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end gap-2 mt-6">
        <button
          type="button"
          @click="close"
          class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {{ $t('common.cancel') }}
        </button>

        <button
          type="button"
          @click="handleExport"
          :disabled="isExporting || filteredTransactions.length === 0"
          class="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          :class="
            exportSuccess
              ? 'bg-[#3FA34D]'
              : 'bg-[#C8A5FC] hover:bg-[#B38BF5] text-white'
          "
        >
          <template v-if="exportSuccess">
            <i class="fas fa-check"></i>
            {{ $t('common.downloaded') }}
          </template>
          <template v-else-if="isExporting">
            <i class="fas fa-spinner fa-spin"></i>
            {{ $t('export.exporting') }}
          </template>
          <template v-else>
            <i class="fas fa-download"></i>
            {{ $t('export.exportButton', { format: exportFormat.toUpperCase() }) }}
          </template>
        </button>
      </div>
    </div>
  </div>
</template>
