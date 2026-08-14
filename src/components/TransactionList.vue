<script setup>
import { computed, ref } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useAuthStore } from '@/stores/auth'
import EditTransactionDialog from './EditTransactionDialog.vue'

const props = defineProps({
  groupId: { type: String, required: true },
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
  customCategories: { type: Array, default: () => [] },
})
const transactionsStore = useTransactionsStore()
const authStore = useAuthStore()

const sorted = computed(() => [...props.transactions].reverse())
const editingTransaction = ref(null)
const showEditDialog = ref(false)
const showPermissionAlert = ref(false)
const permissionTx = ref(null)

function memberName(uid) {
  return props.members?.[uid]?.displayName || 'Someone'
}

function handleDelete(txId) {
  transactionsStore.deleteTransaction(props.groupId, txId)
}

function canEdit(tx) {
  return tx.paidBy === authStore.user?.uid
}

function handleEdit(tx) {
  if (canEdit(tx)) {
    editingTransaction.value = tx
    showEditDialog.value = true
  } else {
    permissionTx.value = tx
    showPermissionAlert.value = true
  }
}
</script>

<template>
  <div class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
    <div class="text-base font-medium mb-3 font-display dark:text-white">Transactions</div>

    <div v-if="!transactions.length" class="bg-[#A5E3FC]/20 border border-[#A5E3FC] text-[#A5E3FC] rounded-lg p-3">
      No transactions yet — log the first deposit or expense to get started.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="tx in sorted"
        :key="tx.id"
        class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div
          :class="tx.type === 'deposit' ? 'bg-[#A7F49D]' : 'bg-[#C1503A]'"
          class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        >
          <svg
            class="w-4.5 h-4.5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              v-if="tx.type === 'deposit'"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
            <path
              v-else
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-start">
            <span class="font-medium truncate dark:text-white">{{ tx.description || tx.category }}</span>
            <span
              class="font-bold money dark:text-white"
              :class="tx.type === 'deposit' ? 'text-[#A7F49D]' : 'text-[#C1503A]'"
            >
              {{ tx.type === 'deposit' ? '+' : '-' }}{{ tx.amount.toFixed(2) }}
            </span>
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {{ tx.date }} · {{ memberName(tx.paidBy) }} · {{ tx.category }}
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button
            @click="handleEdit(tx)"
            class="text-gray-400 hover:text-[#C8A5FC] transition-colors p-1"
            :class="{ 'opacity-50': !canEdit(tx) }"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            @click="handleDelete(tx.id)"
            class="text-gray-400 hover:text-red-500 transition-colors p-1"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <EditTransactionDialog
      v-model="showEditDialog"
      :transaction="editingTransaction"
      :group-id="groupId"
      :custom-categories="customCategories"
    />

    <!-- Permission Alert Dialog -->
    <div v-if="showPermissionAlert" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="showPermissionAlert = false" />
      <div class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[420px] mx-4">
        <h2 class="text-lg font-semibold font-display mb-4 dark:text-white">Permission Required</h2>
        <p class="text-gray-700 dark:text-gray-300 mb-4">
          You can only edit transactions you created. This transaction was created by <strong>{{ memberName(permissionTx?.paidBy) }}</strong>.
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
          If you need to edit this transaction, please ask {{ memberName(permissionTx?.paidBy) }} to make the changes or contact your group administrator.
        </p>
        <div class="flex justify-end gap-2">
          <button
            @click="showPermissionAlert = false"
            class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
