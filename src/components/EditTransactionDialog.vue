<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { CATEGORIES } from '@/constants/categories'

const props = defineProps({ 
  modelValue: Boolean,
  transaction: { type: Object, default: null },
  groupId: { type: String, required: true },
  customCategories: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const transactionsStore = useTransactionsStore()

const type = ref('expense')
const amount = ref('')
const category = ref(CATEGORIES[0])
const description = ref('')
const date = ref(new Date().toISOString().slice(0, 10))
const loading = ref(false)
const amountInput = ref(null)

const allCategories = computed(() => {
  const customNames = props.customCategories.map(cat => cat.name)
  const defaultCategories = CATEGORIES.filter(cat => !customNames.includes(cat))
  return [...customNames, ...defaultCategories]
})

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.transaction) {
    type.value = props.transaction.type
    amount.value = props.transaction.amount
    category.value = props.transaction.category
    description.value = props.transaction.description || ''
    date.value = props.transaction.date
    nextTick(() => {
      amountInput.value?.focus()
    })
  }
})

async function handleUpdate() {
  if (!amount.value || Number(amount.value) <= 0) return
  loading.value = true
  try {
    await transactionsStore.updateTransaction(props.groupId, props.transaction.id, {
      amount: amount.value,
      type: type.value,
      category: category.value,
      description: description.value,
      date: date.value,
      paidBy: props.transaction.paidBy,
    })
    emit('update:modelValue', false)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="props.modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" @click="emit('update:modelValue', false)" />
    <div class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[420px] mx-4">
      <h2 class="text-lg font-semibold font-display mb-4 dark:text-white">Edit transaction</h2>

      <div class="flex mb-4 divide-x divide-gray-200 dark:divide-gray-600 rounded-lg overflow-hidden">
        <button
          @click="type = 'expense'"
          :class="type === 'expense' ? 'bg-[#C1503A] text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
          class="flex-1 px-4 py-2 transition-colors flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          Expense
        </button>
        <button
          @click="type = 'deposit'"
          :class="type === 'deposit' ? 'bg-[#A7F49D] text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
          class="flex-1 px-4 py-2 transition-colors flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          Deposit
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
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
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <select
            v-model="category"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option v-for="cat in allCategories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
          <input
            v-model="description"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
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
          :disabled="!amount || Number(amount) <= 0"
          class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg v-if="loading" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Update
        </button>
      </div>
    </div>
  </div>
</template>
