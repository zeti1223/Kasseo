<script setup>
import { ref, computed, watch } from "vue";
import { useTransactionsStore } from "@/stores/transactions";
import { CATEGORIES } from "@/constants/categories";

const props = defineProps({
  groupId: { type: String, required: true },
  customCategories: { type: Array, default: () => [] },
  mode: { type: String, default: "kitty" }, // 'kitty' | 'split'
  members: { type: Object, default: () => ({}) },
  currentUserId: { type: String, default: "" },
  settleWith: { type: String, default: null }, // member id, prefills "Settle up"
});
const emit = defineEmits(["settle-with-consumed"]);
const transactionsStore = useTransactionsStore();

const type = ref("expense");
const amount = ref("");
const category = ref(CATEGORIES[0]);
const description = ref("");
const date = ref(new Date().toISOString().slice(0, 10));
const loading = ref(false);
const selectedSplit = ref([]);
const recipient = ref("");

const allCategories = computed(() => {
  const customNames = props.customCategories.map((cat) => cat.name);
  const defaultCategories = CATEGORIES.filter(
    (cat) => !customNames.includes(cat),
  );
  return [...customNames, ...defaultCategories];
});

const memberEntries = computed(() =>
  Object.entries(props.members).map(([id, m]) => ({ id, ...m })),
);
const otherMembers = computed(() =>
  memberEntries.value.filter((m) => m.id !== props.currentUserId),
);
const eachShare = computed(() => {
  if (!amount.value || !selectedSplit.value.length) return null;
  return (Number(amount.value) / selectedSplit.value.length).toFixed(2);
});

// Keep the split selection in sync with the current member list —
// defaults to "split between everyone".
watch(
  () => props.members,
  (m) => {
    selectedSplit.value = Object.keys(m || {});
  },
  { immediate: true, deep: true },
);

// A split-mode fund only has 'expense' and 'settlement' types; a kitty
// fund only has 'expense' and 'deposit'. Keep the current selection valid
// when the fund's mode changes.
watch(
  () => props.mode,
  (m) => {
    if (m === "split" && type.value === "deposit") type.value = "expense";
    if (m === "kitty" && type.value === "settlement") type.value = "expense";
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
}

function memberName(id) {
  return props.members?.[id]?.displayName || "Someone";
}

const canSubmit = computed(() => {
  if (!amount.value || Number(amount.value) <= 0) return false;
  if (type.value === "settlement" && !recipient.value) return false;
  return true;
});

async function handleSubmit() {
  if (!canSubmit.value) return;
  loading.value = true;
  try {
    const payload = {
      amount: amount.value,
      type: type.value,
      description: description.value,
      date: date.value,
    };
    if (type.value === "expense") {
      payload.category = category.value;
      if (props.mode === "split") {
        payload.splitAmong = selectedSplit.value.length
          ? selectedSplit.value
          : Object.keys(props.members);
      }
    }
    if (type.value === "settlement") {
      payload.to = recipient.value;
    }
    await transactionsStore.addTransaction(props.groupId, payload);
    amount.value = "";
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
      Log a transaction
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
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
        Expense
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
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
        Deposit
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
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 11l5-5m0 0l5 5m-5-5v12"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 20H7"
          />
        </svg>
        Settle up
      </button>
    </div>

    <div class="space-y-3">
      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >Amount</label
        >
        <input
          v-model="amount"
          type="number"
          min="0"
          step="0.01"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div v-if="type === 'expense'">
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >Category</label
        >
        <select
          v-model="category"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option v-for="cat in allCategories" :key="cat" :value="cat">
            {{ cat }}
          </option>
        </select>
      </div>

      <div v-if="mode === 'split' && type === 'expense'">
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >Split between</label
        >
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
            {{ m.id === currentUserId ? "You" : m.displayName }}
          </button>
        </div>
        <p
          v-if="eachShare"
          class="text-xs text-gray-500 dark:text-gray-400 mt-1"
        >
          {{ eachShare }} each, split between {{ selectedSplit.length }}
          {{ selectedSplit.length === 1 ? "person" : "people" }}
        </p>
      </div>

      <div v-if="mode === 'split' && type === 'settlement'">
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >Pay to</label
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
          Invite another member before you can settle up.
        </p>
      </div>

      <div>
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >Description (optional)</label
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
          >Date</label
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
      <svg
        v-if="loading"
        class="animate-spin h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      {{ type === "settlement" ? "Record settlement" : "Add transaction" }}
    </button>
  </div>
</template>
