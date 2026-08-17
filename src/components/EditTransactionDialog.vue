<script setup>
import { ref, watch, nextTick, computed } from "vue";
import { useTransactionsStore } from "@/stores/transactions";
import { CATEGORIES } from "@/constants/categories";

const props = defineProps({
  modelValue: Boolean,
  transaction: { type: Object, default: null },
  groupId: { type: String, required: true },
  customCategories: { type: Array, default: () => [] },
  mode: { type: String, default: "kitty" }, // 'kitty' | 'split'
  members: { type: Object, default: () => ({}) },
  currentUserId: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const transactionsStore = useTransactionsStore();

const type = ref("expense");
const amount = ref("");
const category = ref(CATEGORIES[0]);
const description = ref("");
const date = ref(new Date().toISOString().slice(0, 10));
const loading = ref(false);
const amountInput = ref(null);
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
  memberEntries.value.filter((m) => m.id !== props.transaction?.paidBy),
);
const eachShare = computed(() => {
  if (!amount.value || !selectedSplit.value.length) return null;
  return (Number(amount.value) / selectedSplit.value.length).toFixed(2);
});

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.transaction) {
      type.value = props.transaction.type;
      amount.value = props.transaction.amount;
      category.value = props.transaction.category;
      description.value = props.transaction.description || "";
      date.value = props.transaction.date;
      selectedSplit.value = props.transaction.splitAmong?.length
        ? [...props.transaction.splitAmong]
        : Object.keys(props.members);
      recipient.value = props.transaction.to || otherMembers.value[0]?.id || "";
      nextTick(() => {
        amountInput.value?.focus();
      });
    }
  },
);

function toggleSplitMember(id) {
  if (selectedSplit.value.includes(id)) {
    if (selectedSplit.value.length === 1) return;
    selectedSplit.value = selectedSplit.value.filter((m) => m !== id);
  } else {
    selectedSplit.value = [...selectedSplit.value, id];
  }
}

const canSubmit = computed(() => {
  if (!amount.value || Number(amount.value) <= 0) return false;
  if (type.value === "settlement" && !recipient.value) return false;
  return true;
});

async function handleUpdate() {
  if (!canSubmit.value) return;
  loading.value = true;
  try {
    const payload = {
      amount: amount.value,
      type: type.value,
      description: description.value,
      date: date.value,
      paidBy: props.transaction.paidBy,
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
    await transactionsStore.updateTransaction(
      props.groupId,
      props.transaction.id,
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
        Edit transaction
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
          Expense
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
          Deposit
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
            ref="amountInput"
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
            >Paid to</label
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

      <div class="flex justify-end gap-2 mt-6">
        <button
          @click="emit('update:modelValue', false)"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          @click="handleUpdate"
          :disabled="!canSubmit"
          class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <i v-if="loading" class="fas fa-spinner fa-spin"></i>
          Update
        </button>
      </div>
    </div>
  </div>
</template>
