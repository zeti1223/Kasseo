<script setup>
import { computed, onMounted, onUnmounted, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useGroupsStore } from '@/stores/groups'
import { useTransactionsStore } from '@/stores/transactions'
import { ref as dbRef, get } from 'firebase/database'
import { db } from '@/firebase/config'
import StatCard from '@/components/StatCard.vue'
import BalanceOverTimeChart from '@/components/BalanceOverTimeChart.vue'
import CategoryBreakdownChart from '@/components/CategoryBreakdownChart.vue'
import MemberBreakdownChart from '@/components/MemberBreakdownChart.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import TransactionList from '@/components/TransactionList.vue'
import FundSettingsDialog from '@/components/FundSettingsDialog.vue'

const route = useRoute()
const groupsStore = useGroupsStore()
const transactionsStore = useTransactionsStore()

const groupId = computed(() => route.params.id)
const showSettings = ref(false)
const customCategories = ref([])

async function loadCategories() {
  if (!groupId.value) return
  const snap = await get(dbRef(db, `groups/${groupId.value}/categories`))
  customCategories.value = snap.exists() 
    ? Object.entries(snap.val()).map(([id, cat]) => ({ id, ...cat }))
    : []
}

async function load(id) {
  await groupsStore.loadGroup(id)
  await loadCategories()
  transactionsStore.listen(id)
}

onMounted(() => load(groupId.value))
watch(groupId, (id) => load(id))
watch(showSettings, async (isOpen) => {
  if (!isOpen && groupId.value) {
    await groupsStore.loadGroup(groupId.value)
    await loadCategories()
  }
})
onUnmounted(() => transactionsStore.stop())

const totals = computed(() => {
  const deposited = transactionsStore.transactions
    .filter((t) => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0)
  const spent = transactionsStore.transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  return { deposited, spent, balance: deposited - spent }
})
</script>

<template>
  <div v-if="groupsStore.currentGroup" class="max-w-[1100px] mx-auto px-4 py-8">
    <div class="flex items-center gap-4 mb-1">
      <h1 class="text-xl font-bold font-display dark:text-white">{{ groupsStore.currentGroup.name }}</h1>
      <button @click="showSettings = true" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">{{ groupsStore.currentGroup.currency }}</p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <StatCard
        label="Current balance"
        :value="totals.balance"
        :currency="groupsStore.currentGroup.currency"
        color="primary"
        icon="piggy-bank"
      />
      <StatCard
        label="Total deposited"
        :value="totals.deposited"
        :currency="groupsStore.currentGroup.currency"
        color="success"
        icon="arrow-down"
      />
      <StatCard
        label="Total spent"
        :value="totals.spent"
        :currency="groupsStore.currentGroup.currency"
        color="error"
        icon="arrow-up"
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="md:col-span-2">
        <div class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div class="text-base font-medium mb-2 font-display dark:text-white">Balance over time</div>
          <BalanceOverTimeChart :transactions="transactionsStore.transactions" />
        </div>
      </div>
      <div class="md:col-span-1">
        <div class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div class="text-base font-medium mb-2 font-display dark:text-white">By category</div>
          <CategoryBreakdownChart :transactions="transactionsStore.transactions" />
        </div>
      </div>
      <div class="md:col-span-1">
        <div class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div class="text-base font-medium mb-2 font-display dark:text-white">By member</div>
          <MemberBreakdownChart
            :transactions="transactionsStore.transactions"
            :members="groupsStore.currentGroup.members"
          />
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="md:col-span-2">
        <TransactionForm :group-id="groupId" :custom-categories="customCategories" />
      </div>
      <div class="md:col-span-2">
        <TransactionList
          :group-id="groupId"
          :transactions="transactionsStore.transactions"
          :members="groupsStore.currentGroup.members"
          :custom-categories="customCategories"
        />
      </div>
    </div>
  </div>

  <div v-else class="py-16 text-center">
    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8A5FC]"></div>
  </div>

  <FundSettingsDialog v-model="showSettings" :group="groupsStore.currentGroup" />
</template>
