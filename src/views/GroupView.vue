<script setup>
import { computed, onMounted, onUnmounted, watch, ref } from "vue";
import { useRoute } from "vue-router";
import { useGroupsStore } from "@/stores/groups";
import { useTransactionsStore } from "@/stores/transactions";
import { useAuthStore } from "@/stores/auth";
import { ref as dbRef, get } from "firebase/database";
import { db } from "@/services/firebase/config";
import { computeSplitBalances } from "@/utils/chartData";
import ChartCard from "@/components/common/ChartCard.vue";
import GroupHeader from "@/components/features/groups/GroupHeader.vue";
import GroupStats from "@/components/features/groups/GroupStats.vue";
import BalanceOverTimeChart from "@/components/charts/BalanceOverTimeChart.vue";
import CategoryBreakdownChart from "@/components/charts/CategoryBreakdownChart.vue";
import MemberBreakdownChart from "@/components/charts/MemberBreakdownChart.vue";
import MonthlyCashFlowChart from "@/components/charts/MonthlyCashFlowChart.vue";
import CategoryTrendChart from "@/components/charts/CategoryTrendChart.vue";
import MembersBalanceChart from "@/components/charts/MembersBalanceChart.vue";
import BalancesPanel from "@/components/features/groups/BalancesPanel.vue";
import TransactionForm from "@/components/features/transactions/TransactionForm.vue";
import TransactionList from "@/components/features/transactions/TransactionList.vue";
import FundSettingsDialog from "@/components/features/settings/FundSettingsDialog.vue";
import ReceiptScanDialog from "@/components/features/transactions/ReceiptScanDialog.vue";

const route = useRoute();
const groupsStore = useGroupsStore();
const transactionsStore = useTransactionsStore();
const authStore = useAuthStore();

const groupId = computed(() => route.params.id);
const showSettings = ref(false);
const showScan = ref(false);
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
    <GroupHeader
      :name="groupsStore.currentGroup.name"
      :currency="groupsStore.currentGroup.currency"
      @open-settings="showSettings = true"
    />

    <GroupStats
      :mode="mode"
      :totals="totals"
      :currency="groupsStore.currentGroup.currency"
    />

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="md:col-span-2">
        <ChartCard
          :title="
            mode === 'split' ? 'Your balance over time' : 'Balance over time'
          "
        >
          <BalanceOverTimeChart
            :transactions="transactionsStore.transactions"
            :mode="mode"
            :members="groupsStore.currentGroup.members"
            :user-id="authStore.user?.uid"
            :currency="groupsStore.currentGroup.currency"
          />
        </ChartCard>
      </div>
      <div class="md:col-span-1">
        <ChartCard title="By category">
          <CategoryBreakdownChart
            :transactions="transactionsStore.transactions"
            :currency="groupsStore.currentGroup.currency"
          />
        </ChartCard>
      </div>
      <div class="md:col-span-1">
        <ChartCard :title="mode === 'split' ? 'Balances' : 'By member'">
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
            :currency="groupsStore.currentGroup.currency"
          />
        </ChartCard>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <ChartCard
        :title="mode === 'split' ? 'Monthly spending' : 'Monthly cash flow'"
      >
        <MonthlyCashFlowChart
          :transactions="transactionsStore.transactions"
          :currency="groupsStore.currentGroup.currency"
        />
      </ChartCard>
      <ChartCard title="Spending by category, over time">
        <CategoryTrendChart
          :transactions="transactionsStore.transactions"
          :currency="groupsStore.currentGroup.currency"
        />
      </ChartCard>
    </div>

    <div v-if="mode === 'split'" class="grid grid-cols-1 gap-4 mb-6">
      <ChartCard title="Everyone's balance over time">
        <MembersBalanceChart
          :transactions="transactionsStore.transactions"
          :members="groupsStore.currentGroup.members"
          :currency="groupsStore.currentGroup.currency"
        />
      </ChartCard>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="md:col-span-2">
        <button
          @click="showScan = true"
          class="w-full mb-3 px-4 py-2 rounded-lg border border-[#C8A5FC] text-[#C8A5FC] hover:bg-[#C8A5FC]/10 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <i class="fas fa-camera"></i>
          Scan a receipt
        </button>
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
    <i class="fas fa-spinner fa-spin text-3xl text-[#C8A5FC]"></i>
  </div>

  <FundSettingsDialog
    v-model="showSettings"
    :group="groupsStore.currentGroup"
  />
  <ReceiptScanDialog
    v-if="groupsStore.currentGroup"
    v-model="showScan"
    :group-id="groupId"
    :custom-categories="customCategories"
    :mode="mode"
    :members="groupsStore.currentGroup.members"
  />
</template>
