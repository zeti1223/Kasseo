<script setup>
import { ref, computed, watch } from "vue";
import { useTransactionsStore } from "@/stores/transactions";
import { CATEGORIES, getCategoryIcon, getCategoryLabel } from "@/constants/categories";
import { CURRENCIES } from "@/constants/currencies";
import { handleNumberKeyDown, handleNumberPaste } from "@/utils/numberInput";

const props = defineProps({
  groupId: { type: String, required: true },
  groupCurrency: { type: String, required: true },
  customCategories: { type: Array, default: () => [] },
  mode: { type: String, default: "kitty" }, // 'kitty' | 'split'
  members: { type: Object, default: () => ({}) },
  currentUserId: { type: String, default: "" },
  settleWith: { type: String, default: null }, // member id, prefills "Settle up"
});
const emit = defineEmits(["settle-with-consumed"]);
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
  memberEntries.value.filter((m) => m.id !== props.currentUserId),
);
const eachShare = computed(() => {
  if (!amount.value || !selectedSplit.value.length) return null;
  return (Number(amount.value) / selectedSplit.value.length).toFixed(2);
});

// Sum of the percent inputs; must reach 100 before submit is allowed.
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

// Spreads 100% evenly, dropping any rounding remainder onto the last member.
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

// Only auto-fills an even spread the first time; doesn't clobber
// numbers the user already typed.
function enablePercentSplit() {
  splitType.value = "percent";
  if (!selectedSplit.value.some((id) => splitPercents.value[id] !== undefined)) {
    splitPercentsEvenly();
  }
}

// Keep the split selection in sync with the member list.
watch(
  () => props.members,
  (m) => {
    selectedSplit.value = Object.keys(m || {});
    if (splitType.value === "percent") splitPercentsEvenly();
  },
  { immediate: true, deep: true },
);

// Keep the selected type valid when the fund's mode changes.
watch(
  () => props.mode,
  (m) => {
    if (m === "split" && type.value === "deposit") type.value = "expense";
    if (m === "kitty" && type.value === "settlement") type.value = "expense";
  },
  { immediate: true },
);

// Default the currency picker to the fund's currency; user can override it.
watch(
  () => props.groupCurrency,
  (c) => {
    currency.value = c;
  },
  { immediate: true },
);

// BalancesPanel can ask this form to prefill a "Settle up" for a member.
watch(
  () => props.settleWith,
  (uid) => {
    if (!uid) return;
    type.value = "settlement";
    recipient.value = uid;
    emit("settle-with-consumed");
  },
);

watch(otherMembers, (list) => {
  if (!recipient.value && list.length) recipient.value = list[0].id;
});

function toggleSplitMember(id) {
  if (selectedSplit.value.includes(id)) {
    if (selectedSplit.value.length === 1) return; // keep at least one payer
    selectedSplit.value = selectedSplit.value.filter((m) => m !== id);
  } else {
    selectedSplit.value = [...selectedSplit.value, id];
  }
  if (splitType.value === "percent") splitPercentsEvenly();
}

function memberName(id) {
  return (
    props.members?.[id]?.nickname ||
    props.members?.[id]?.displayName ||
    "Someone"
  );
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

async function handleSubmit() {
  if (!canSubmit.value) return;
  loading.value = true;
  try {
    const payload = {
      amount: amount.value,
      currency: currency.value,
      type: type.value,
      description: description.value,
      date: date.value,
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
    await transactionsStore.addTransaction(
      props.groupId,
      props.groupCurrency,
      payload,
    );
    amount.value = "";
    currency.value = props.groupCurrency;
    description.value = "";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
  >
    <div class="text-base font-medium mb-3 font-display dark:text-white">
      {{ $t('transactions.logTransaction') }}
    </div>

    <div
      class="flex mb-4 divide-x divide-gray-200 dark:divide-gray-600 rounded-lg overflow-hidden"
    >
      <button
        @click="type = 'expense'"
        :class="
          type === 'expense'
            ? 'bg-[#C1503A] text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        "
        class="flex-1 px-4 py-2 transition-colors flex items-center justify-center gap-2"
      >
        <i class="fas fa-arrow-up"></i>
        {{ $t('transactions.expense') }}
      </button>

      <button
        v-if="mode === 'kitty'"
        @click="type = 'deposit'"
        :class="
          type === 'deposit'
            ? 'bg-[#A7F49D] text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        "
        class="flex-1 px-4 py-2 transition-colors flex items-center justify-center gap-2"
      >
        <i class="fas fa-arrow-down"></i>
        {{ $t('transactions.deposit') }}
      </button>

      <button
        v-else
        @click="type = 'settlement'"
        :class="
          type === 'settlement'
            ? 'bg-[#A5E3FC] text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        "
        class="flex-1 px-4 py-2 transition-colors flex items-center justify-center gap-2"
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
            v-model="amount"
            type="number"
            min="0"
            step="0.01"
            @keydown="handleNumberKeyDown($event)"
            @paste="handleNumberPaste($event)"
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
          {{ $t('transactions.currencyConvertNotice', { currency: groupCurrency }) }}
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
              @keydown="handleNumberKeyDown($event)"
              @paste="handleNumberPaste($event)"
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
        <p
          v-if="!otherMembers.length"
          class="text-xs text-gray-500 dark:text-gray-400 mt-1"
        >
          {{ $t('transactions.inviteToSettle') }}
        </p>
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

    <button
      @click="handleSubmit"
      :disabled="!canSubmit"
      class="w-full mt-4 px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      <i v-if="loading" class="fas fa-spinner fa-spin h-4 w-4"></i>
      {{ type === "settlement" ? $t('transactions.recordSettlement') : $t('transactions.addTransaction') }}
    </button>
  </div>
</template>
