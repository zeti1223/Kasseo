<script setup>
import { ref, computed } from "vue";
import { useTransactionsStore } from "@/stores/transactions";
import { CATEGORIES } from "@/constants/categories";

const props = defineProps({
  groupId: { type: String, required: true },
  customCategories: { type: Array, default: () => [] },
});
const transactionsStore = useTransactionsStore();

const type = ref("expense");
const amount = ref("");
const category = ref(CATEGORIES[0]);
const description = ref("");
const date = ref(new Date().toISOString().slice(0, 10));
const loading = ref(false);

const allCategories = computed(() => {
  const customNames = props.customCategories.map((cat) => cat.name);
  const defaultCategories = CATEGORIES.filter(
    (cat) => !customNames.includes(cat),
  );
  return [...customNames, ...defaultCategories];
});

async function handleSubmit() {
  if (!amount.value || Number(amount.value) <= 0) return;
  loading.value = true;
  try {
    await transactionsStore.addTransaction(props.groupId, {
      amount: amount.value,
      type: type.value,
      category: category.value,
      description: description.value,
      date: date.value,
    });
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
      :disabled="!amount || Number(amount) <= 0"
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
      Add transaction
    </button>
  </div>
</template>
