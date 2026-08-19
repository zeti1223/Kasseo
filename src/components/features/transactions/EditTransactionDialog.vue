<script setup>
import { ref, watch, nextTick, computed } from "vue";
import { useTransactionsStore } from "@/stores/transactions";
import { CATEGORIES, getCategoryIcon, getCategoryLabel } from "@/constants/categories";
import { CURRENCIES } from "@/constants/currencies";

const props = defineProps({
  modelValue: Boolean,
  transaction: { type: Object, default: null },
  groupId: { type: String, required: true },
  groupCurrency: { type: String, required: true },
  customCategories: { type: Array, default: () => [] },
  mode: { type: String, default: "kitty" }, // 'kitty' | 'split'
  members: { type: Object, default: () => ({}) },
  currentUserId: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const transactionsStore = useTransactionsStore();

function categoryIcon(catName) {
  const customCat = props.customCategories.find((c) => c.name === catName);
  return getCategoryIcon(catName, customCat?.icon);
}

const type = ref("expense");
const amount = ref("");
const currency = ref(props.groupCurrency);
const category = ref(CATEGORIES[0]);
const description = ref("");
const date = ref(new Date().toISOString().slice(0, 10));
const loading = ref(false);
const amountInput = ref(null);
const selectedSplit = ref([]);
const recipient = ref("");
const splitType = ref("equal"); // 'equal' | 'percent'
const splitPercents = ref({}); // member id -> percent (string, as typed)

const allCategories = computed(() => {
  const customNames = props.customCategories.map((cat) => cat.name);
  const defaultCategories = CATEGORIES.filter(
    (cat) => !customNames.includes(cat),
  );
  return [...customNames, ...defaultCategories];
});

const memberEntries = computed(() =>
  Object.entries(props.members).map(([id, m]) => ({
    id,
    ...m,
    displayName: m.nickname || m.displayName || "Someone",
  })),
);
const otherMembers = computed(() =>
  memberEntries.value.filter((m) => m.id !== props.transaction?.paidBy),
);
const eachShare = computed(() => {
  if (!amount.value || !selectedSplit.value.length) return null;
  return (Number(amount.value) / selectedSplit.value.length).toFixed(2);
});

const totalPercent = computed(() =>
  selectedSplit.value.reduce(
    (sum, id) => sum + (Number(splitPercents.value[id]) || 0),
    0,
  ),
);
const percentValid = computed(() => Math.abs(totalPercent.value - 100) < 0.01);

function percentShareAmount(id) {
  if (!amount.value) return null;
  const pct = Number(splitPercents.value[id]) || 0;
  return ((Number(amount.value) * pct) / 100).toFixed(2);
}

function splitPercentsEvenly() {
  const ids = selectedSplit.value;
  if (!ids.length) return;
  const even = +(100 / ids.length).toFixed(2);
  const next = {};
  ids.forEach((id, i) => {
    next[id] = i === ids.length - 1 ? +(100 - even * (ids.length - 1)).toFixed(2) : even;
  });
  splitPercents.value = next;
}

function memberName(id) {
  return (
    props.members?.[id]?.nickname ||
    props.members?.[id]?.displayName ||
    "Someone"
  );
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.transaction) {
      type.value = props.transaction.type;
      // Use the originally entered value, not the converted amount, so
      // re-saving without changes skips a redundant reconversion.
      amount.value = props.transaction.originalAmount ?? props.transaction.amount;
      currency.value = props.transaction.originalCurrency ?? props.groupCurrency;
      category.value = props.transaction.category;
      description.value = props.transaction.description || "";
      date.value = props.transaction.date;
      selectedSplit.value = props.transaction.splitAmong?.length
        ? [...props.transaction.splitAmong]
        : Object.keys(props.members);
      if (props.transaction.splitType === "percent" && props.transaction.splitShares) {
        splitType.value = "percent";
        splitPercents.value = { ...props.transaction.splitShares };
      } else {
        splitType.value = "equal";
        splitPercents.value = {};
      }
      recipient.value = props.transaction.to || otherMembers.value[0]?.id || "";
      nextTick(() => {
        amountInput.value?.focus();
      });
    }
  },
);

function toggleSplitMember(id) {
  if (selectedSplit.value.includes(id)) {
    if (selectedSplit.value.length === 1) return; // keep at least one payer
    selectedSplit.value = selectedSplit.value.filter((m) => m !== id);
  } else {
    selectedSplit.value = [...selectedSplit.value, id];
  }
  if (splitType.value === "percent") splitPercentsEvenly();
}

// Don't auto-fill if the transaction already has percent splits loaded.
function enablePercentSplit() {
  splitType.value = "percent";
  if (!selectedSplit.value.some((id) => splitPercents.value[id] !== undefined)) {
    splitPercentsEvenly();
  }
}

const canSubmit = computed(() => {
  if (!amount.value || Number(amount.value) <= 0) return false;
  if (type.value === "settlement" && !recipient.value) return false;
  if (
    props.mode === "split" &&
    type.value === "expense" &&
    splitType.value === "percent" &&
    !percentValid.value
  )
    return false;
  return true;
});

async function handleUpdate() {
  if (!canSubmit.value) return;
  loading.value = true;
  try {
    const payload = {
      amount: amount.value,
      currency: currency.value,
      type: type.value,
      description: description.value,
      date: date.value,
      paidBy: props.transaction.paidBy,
    };
    if (type.value === "expense") {
      payload.category = category.value;
      payload.categoryIcon = categoryIcon(category.value);
      if (props.mode === "split") {
        payload.splitAmong = selectedSplit.value.length
          ? selectedSplit.value
          : Object.keys(props.members);
        if (splitType.value === "percent") {
          payload.splitType = "percent";
          payload.splitShares = Object.fromEntries(
            payload.splitAmong.map((id) => [
              id,
              Number(splitPercents.value[id]) || 0,
            ]),
          );
        }
      }
    }
    if (type.value === "settlement") {
      payload.to = recipient.value;
    }
    await transactionsStore.updateTransaction(
      props.groupId,
      props.transaction.id,
      props.groupCurrency,
      payload,
    );
    emit("update:modelValue", false);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    v-if="props.modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center"
  >
    <div
      class="absolute inset-0 bg-black/50"
      @click="emit('update:modelValue', false)"
    />
    <div
      class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[420px] mx-4"
    >
      <h2 class="text-lg font-semibold font-display mb-4 dark:text-white">
        {{ $t('transactions.editTransaction') }}
      </h2>

      <div
        class="flex mb-4 divide-x divide-gray-200 dark:divide-gray-600 rounded-lg overflow-hidden"
      >
        <button
          @click="type = 'expense'"
          class="flex-1 px-4 py-2 transition-colors flex items-center justify-center gap-2"
          :class="
            type === 'expense'
              ? 'bg-[#C1503A] text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          "
        >
          <i class="fas fa-arrow-up"></i>
          {{ $t('transactions.expense') }}
        </button>

        <button
          v-if="mode === 'kitty'"
          @click="type = 'deposit'"
          class="flex-1 px-4 py-2 transition-colors flex items-center justify-center gap-2"
          :class="
            type === 'deposit'
              ? 'bg-[#A7F49D] text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          "
        >
          <i class="fas fa-arrow-down"></i>
          {{ $t('transactions.deposit') }}
        </button>

        <button
          v-else
          @click="type = 'settlement'"
          class="flex-1 px-4 py-2 transition-colors flex items-center justify-center gap-2"
          :class="
            type === 'settlement'
              ? 'bg-[#A5E3FC] text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          "
        >
          <i class="fas fa-handshake"></i>
          {{ $t('transactions.settleUp') }}
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >{{ $t('common.amount') }}</label
          >
          <div class="flex gap-2">
            <input
              ref="amountInput"
              v-model="amount"
              type="number"
              min="0"
              step="0.01"
              class="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            <select
              v-model="currency"
              class="w-24 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option v-for="curr in CURRENCIES" :key="curr" :value="curr">
                {{ curr }}
              </option>
            </select>
          </div>
          <p
            v-if="currency !== groupCurrency"
            class="text-xs text-gray-500 dark:text-gray-400 mt-1"
          >
            {{ $t('transactions.currencyReconvertNotice', { currency: groupCurrency }) }}
          </p>
        </div>
        <div v-if="type === 'expense'">
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >{{ $t('common.category') }}</label
          >
          <div class="relative flex items-center">
            <div class="absolute left-3 text-gray-500 dark:text-gray-400 text-sm pointer-events-none">
              <i :class="categoryIcon(category)"></i>
            </div>
            <select
              v-model="category"
              class="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option v-for="cat in allCategories" :key="cat" :value="cat">
                {{ getCategoryLabel(cat, $t) }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="mode === 'split' && type === 'expense'">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >{{ $t('transactions.splitBetween') }}</label
            >
            <div class="flex text-xs rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
              <button
                type="button"
                @click="splitType = 'equal'"
                class="px-2.5 py-1 transition-colors"
                :class="
                  splitType === 'equal'
                    ? 'bg-[#C8A5FC] text-white'
                    : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                "
              >
                {{ $t('transactions.equal') }}
              </button>
              <button
                type="button"
                @click="enablePercentSplit"
                class="px-2.5 py-1 transition-colors"
                :class="
                  splitType === 'percent'
                    ? 'bg-[#C8A5FC] text-white'
                    : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                "
              >
                {{ $t('transactions.percent') }}
              </button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="m in memberEntries"
              :key="m.id"
              type="button"
              @click="toggleSplitMember(m.id)"
              class="text-xs px-3 py-1.5 rounded-full border transition-colors"
              :class="
                selectedSplit.includes(m.id)
                  ? 'bg-[#C8A5FC] border-[#C8A5FC] text-white'
                  : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
              "
            >
              {{ m.id === currentUserId ? $t('common.you') : m.displayName }}
            </button>
          </div>

          <p
            v-if="splitType === 'equal' && eachShare"
            class="text-xs text-gray-500 dark:text-gray-400 mt-1"
          >
            {{ $t('transactions.eachShare', { amount: eachShare, count: selectedSplit.length }) }}
          </p>

          <div v-if="splitType === 'percent'" class="mt-2 space-y-1.5">
            <div
              v-for="id in selectedSplit"
              :key="id"
              class="flex items-center gap-2"
            >
              <span class="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate">
                {{ id === currentUserId ? $t('common.you') : memberName(id) }}
              </span>
              <input
                v-model="splitPercents[id]"
                type="number"
                min="0"
                max="100"
                step="0.01"
                class="w-16 px-2 py-1 text-xs text-right border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <span class="text-xs text-gray-500 dark:text-gray-400 w-4">%</span>
              <span
                v-if="percentShareAmount(id)"
                class="text-xs text-gray-400 dark:text-gray-500 w-16 text-right"
              >
                {{ percentShareAmount(id) }}
              </span>
            </div>
            <div class="flex items-center justify-between pt-0.5">
              <button
                type="button"
                @click="splitPercentsEvenly"
                class="text-xs text-[#8A5FBF] dark:text-[#C8A5FC] hover:underline"
              >
                {{ $t('transactions.splitEvenly') }}
              </button>
              <span
                class="text-xs"
                :class="
                  percentValid
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-[#C1503A] font-medium'
                "
              >
                {{ $t('common.total') }}: {{ totalPercent.toFixed(2) }}%
              </span>
            </div>
          </div>
        </div>

        <div v-if="mode === 'split' && type === 'settlement'">
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >{{ $t('transactions.payTo') }}</label
          >
          <select
            v-model="recipient"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option v-for="m in otherMembers" :key="m.id" :value="m.id">
              {{ m.displayName }}
            </option>
          </select>
        </div>

        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >{{ $t('common.descriptionOptional') }}</label
          >
          <input
            v-model="description"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >{{ $t('common.date') }}</label
          >
          <input
            v-model="date"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-6">
        <button
          @click="emit('update:modelValue', false)"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="handleUpdate"
          :disabled="!canSubmit"
          class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <i v-if="loading" class="fas fa-spinner fa-spin"></i>
          {{ $t('common.update') }}
        </button>
      </div>
    </div>
  </div>
</template>
