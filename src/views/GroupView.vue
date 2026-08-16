<script setup>
import { computed, onMounted, onUnmounted, watch, ref } from "vue";
import { useRoute } from "vue-router";
import { useGroupsStore } from "@/stores/groups";
import { useTransactionsStore } from "@/stores/transactions";
import { useAuthStore } from "@/stores/auth";
import { ref as dbRef, get } from "firebase/database";
import { db } from "@/firebase/config";
import { computeSplitBalances } from "@/utils/chartData";
import StatCard from "@/components/StatCard.vue";
import BalanceOverTimeChart from "@/components/BalanceOverTimeChart.vue";
import CategoryBreakdownChart from "@/components/CategoryBreakdownChart.vue";
import MemberBreakdownChart from "@/components/MemberBreakdownChart.vue";
import BalancesPanel from "@/components/BalancesPanel.vue";
import TransactionForm from "@/components/TransactionForm.vue";
import TransactionList from "@/components/TransactionList.vue";
import FundSettingsDialog from "@/components/FundSettingsDialog.vue";

const route = useRoute();
const groupsStore = useGroupsStore();
const transactionsStore = useTransactionsStore();
const authStore = useAuthStore();

const groupId = computed(() => route.params.id);
const showSettings = ref(false);
const customCategories = ref([]);
const settleTarget = ref(null); // member id prefilled into the "Settle up" form

const mode = computed(() => groupsStore.currentGroup?.mode || "kitty");

function handleSettle(memberId) {
  settleTarget.value = memberId;
}

async function loadCategories() {
  if (!groupId.value) return;
  const snap = await get(dbRef(db, `groups/${groupId.value}/categories`));
  customCategories.value = snap.exists()
    ? Object.entries(snap.val()).map(([id, cat]) => ({ id, ...cat }))
    : [];
}

async function load(id) {
  await groupsStore.loadGroup(id);
  await loadCategories();
  transactionsStore.listen(id);
}

onMounted(() => load(groupId.value));
watch(groupId, (id) => load(id));
watch(showSettings, async (isOpen) => {
  if (!isOpen && groupId.value) {
    await groupsStore.loadGroup(groupId.value);
    await loadCategories();
  }
});
onUnmounted(() => transactionsStore.stop());

const totals = computed(() => {
  if (mode.value === "split") {
    const balances = computeSplitBalances(
      transactionsStore.transactions,
      groupsStore.currentGroup?.members,
    );
    const yourBalance = balances[authStore.user?.uid] || 0;
    const youPaid = transactionsStore.transactions
      .filter((t) => t.type === "expense" && t.paidBy === authStore.user?.uid)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = transactionsStore.transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return { yourBalance, youPaid, totalSpent };
  }
  const deposited = transactionsStore.transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const spent = transactionsStore.transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  return { deposited, spent, balance: deposited - spent };
});
</script>

<template>
  <div v-if="groupsStore.currentGroup" class="max-w-[1100px] mx-auto px-4 py-8">
    <div class="flex items-center gap-4 mb-1">
      <h1 class="text-xl font-bold font-display dark:text-white">
        {{ groupsStore.currentGroup.name }}
      </h1>
      <button
        @click="showSettings = true"
        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <i class="fas fa-cog"></i>
      </button>
    </div>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
      {{ groupsStore.currentGroup.currency }}
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <template v-if="mode === 'split'">
        <StatCard
          label="Your balance"
          :value="totals.yourBalance"
          :currency="groupsStore.currentGroup.currency"
          :color="totals.yourBalance >= 0 ? 'success' : 'error'"
          icon="piggy-bank"
        />
        <StatCard
          label="You paid"
          :value="totals.youPaid"
          :currency="groupsStore.currentGroup.currency"
          color="primary"
          icon="arrow-up"
        />
        <StatCard
          label="Total spent"
          :value="totals.totalSpent"
          :currency="groupsStore.currentGroup.currency"
          color="warning"
          icon="arrow-up"
        />
      </template>
      <template v-else>
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
      </template>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="md:col-span-2">
        <div
          class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div class="text-base font-medium mb-2 font-display dark:text-white">
            {{
              mode === "split" ? "Your balance over time" : "Balance over time"
            }}
          </div>
          <BalanceOverTimeChart
            :transactions="transactionsStore.transactions"
            :mode="mode"
            :members="groupsStore.currentGroup.members"
            :user-id="authStore.user?.uid"
          />
        </div>
      </div>
      <div class="md:col-span-1">
        <div
          class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div class="text-base font-medium mb-2 font-display dark:text-white">
            By category
          </div>
          <CategoryBreakdownChart
            :transactions="transactionsStore.transactions"
          />
        </div>
      </div>
      <div class="md:col-span-1">
        <div
          class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div class="text-base font-medium mb-2 font-display dark:text-white">
            {{ mode === "split" ? "Balances" : "By member" }}
          </div>
          <BalancesPanel
            v-if="mode === 'split'"
            :transactions="transactionsStore.transactions"
            :members="groupsStore.currentGroup.members"
            :current-user-id="authStore.user?.uid"
            :currency="groupsStore.currentGroup.currency"
            @settle="handleSettle"
          />
          <MemberBreakdownChart
            v-else
            :transactions="transactionsStore.transactions"
            :members="groupsStore.currentGroup.members"
          />
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="md:col-span-2">
        <TransactionForm
          :group-id="groupId"
          :custom-categories="customCategories"
          :mode="mode"
          :members="groupsStore.currentGroup.members"
          :current-user-id="authStore.user?.uid"
          :settle-with="settleTarget"
          @settle-with-consumed="settleTarget = null"
        />
      </div>
      <div class="md:col-span-2">
        <TransactionList
          :group-id="groupId"
          :transactions="transactionsStore.transactions"
          :members="groupsStore.currentGroup.members"
          :custom-categories="customCategories"
          :mode="mode"
        />
      </div>
    </div>
  </div>

  <div v-else class="py-16 text-center">
    <div
      class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#C8A5FC]"
    ></div>
  </div>

  <FundSettingsDialog
    v-model="showSettings"
    :group="groupsStore.currentGroup"
  />
</template>
