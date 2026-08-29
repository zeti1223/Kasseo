<script setup>
import { computed, onMounted, onUnmounted, watch, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
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
import ExportDialog from "@/components/features/export/ExportDialog.vue";
import ImportDialog from "@/components/features/import/ImportDialog.vue";
import { getMyFundColor, getFundIcon } from "@/constants/fundStyle";

const route = useRoute();
const router = useRouter();
const groupsStore = useGroupsStore();
const transactionsStore = useTransactionsStore();
const authStore = useAuthStore();

const groupId = computed(() => route.params.id);
const showSettings = ref(false);
const showScan = ref(false);
const showExport = ref(false);
const showImport = ref(false);
const customCategories = ref([]);
const settleTarget = ref(null); // { memberId, amount } prefilled into the "Settle up" form

const mode = computed(() => groupsStore.currentGroup?.mode || "kitty");
const myColor = computed(() =>
  getMyFundColor(groupsStore.currentGroup, authStore.user?.uid),
);
const groupIcon = computed(() => getFundIcon(groupsStore.currentGroup));

const mobileTab = ref("transactions"); // 'transactions' | 'balances' | 'charts'

function handleSettle(payload) {
  settleTarget.value = payload;
  // Automatically switch to transactions tab on mobile so user sees prefilled form
  mobileTab.value = "transactions";
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
  groupsStore.listenToGroup(id);
}

onMounted(() => load(groupId.value));
watch(groupId, (id) => load(id));
watch(
  () => groupsStore.currentGroup,
  (group) => {
    if (group === null) {
      router.push({ name: "dashboard" });
    } else if (
      group &&
      authStore.user?.uid &&
      group.members &&
      !group.members[authStore.user.uid]
    ) {
      router.push({ name: "dashboard" });
    }
  },
  { deep: true },
);
watch(showSettings, async (isOpen) => {
  if (!isOpen && groupId.value) {
    await groupsStore.loadGroup(groupId.value);
    await loadCategories();
  }
});
onUnmounted(() => {
  transactionsStore.stop();
  groupsStore.stopGroupListener();
});

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
  <div v-if="groupsStore.currentGroup" class="max-w-[1100px] mx-auto px-4 py-4 sm:py-8 pb-16 md:pb-8">
    <GroupHeader
      :name="groupsStore.currentGroup.name"
      :currency="groupsStore.currentGroup.currency"
      :icon="groupIcon"
      :color="myColor"
      @open-settings="showSettings = true"
      @open-export="showExport = true"
      @open-import="showImport = true"
    />

    <GroupStats
      :mode="mode"
      :totals="totals"
      :currency="groupsStore.currentGroup.currency"
    />

    <!-- ============================================================ -->
    <!-- MOBILE VIEW (< md) : Segmented Tabs for Ultra Clean Mobile UX -->
    <!-- ============================================================ -->
    <div class="block md:hidden mb-6">
      <!-- Mobile Segmented Tab Switcher -->
      <div class="flex p-1 bg-gray-200/70 dark:bg-gray-800 rounded-xl mb-4 text-xs font-semibold">
        <button
          type="button"
          @click="mobileTab = 'transactions'"
          class="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all"
          :class="
            mobileTab === 'transactions'
              ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-xs font-bold'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          "
        >
          <i class="fas fa-list-ul text-[11px]"></i>
          <span>{{ $t('mobileTabs.transactions') }}</span>
          <span
            v-if="transactionsStore.transactions?.length"
            class="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full"
            :class="
              mobileTab === 'transactions'
                ? 'bg-primary/20 text-primary-dark-dark dark:text-primary'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            "
          >
            {{ transactionsStore.transactions.length }}
          </span>
        </button>

        <button
          type="button"
          @click="mobileTab = 'balances'"
          class="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all"
          :class="
            mobileTab === 'balances'
              ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-xs font-bold'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          "
        >
          <i class="fas fa-users text-[11px]"></i>
          <span>{{ $t('mobileTabs.balances') }}</span>
        </button>

        <button
          type="button"
          @click="mobileTab = 'charts'"
          class="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all"
          :class="
            mobileTab === 'charts'
              ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-xs font-bold'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          "
        >
          <i class="fas fa-chart-pie text-[11px]"></i>
          <span>{{ $t('mobileTabs.charts') }}</span>
        </button>
      </div>

      <!-- Tab 1: Transactions & Form -->
      <div v-show="mobileTab === 'transactions'" class="space-y-4">
        <button
          @click="showScan = true"
          class="w-full py-2.5 px-4 rounded-xl border border-[#C8A5FC] bg-[#C8A5FC]/10 text-[#8A5FBF] dark:text-[#C8A5FC] hover:bg-[#C8A5FC]/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm font-semibold shadow-xs"
        >
          <i class="fas fa-camera text-base"></i>
          {{ $t('transactions.scanReceipt') }}
        </button>

        <TransactionForm
          :group-id="groupId"
          :group-currency="groupsStore.currentGroup.currency"
          :custom-categories="customCategories"
          :mode="mode"
          :members="groupsStore.currentGroup.members"
          :current-user-id="authStore.user?.uid"
          :settle-with="settleTarget"
          @settle-with-consumed="settleTarget = null"
        />

        <TransactionList
          :group-id="groupId"
          :group-currency="groupsStore.currentGroup.currency"
          :transactions="transactionsStore.transactions"
          :members="groupsStore.currentGroup.members"
          :custom-categories="customCategories"
          :mode="mode"
          @export="showExport = true"
        />
      </div>

      <!-- Tab 2: Balances & Members -->
      <div v-show="mobileTab === 'balances'" class="space-y-4">
        <ChartCard :title="mode === 'split' ? $t('charts.balances') : $t('charts.byMember')">
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

        <ChartCard v-if="mode === 'split'" :title="$t('charts.everyonesBalance')">
          <MembersBalanceChart
            :transactions="transactionsStore.transactions"
            :members="groupsStore.currentGroup.members"
            :currency="groupsStore.currentGroup.currency"
          />
        </ChartCard>
      </div>

      <!-- Tab 3: Charts & Stats -->
      <div v-show="mobileTab === 'charts'" class="space-y-4">
        <ChartCard
          :title="
            mode === 'split' ? $t('charts.yourBalanceOverTime') : $t('charts.balanceOverTime')
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

        <ChartCard :title="$t('charts.byCategory')">
          <CategoryBreakdownChart
            :transactions="transactionsStore.transactions"
            :currency="groupsStore.currentGroup.currency"
          />
        </ChartCard>

        <ChartCard
          :title="mode === 'split' ? $t('charts.monthlySpending') : $t('charts.monthlyCashFlow')"
        >
          <MonthlyCashFlowChart
            :transactions="transactionsStore.transactions"
            :currency="groupsStore.currentGroup.currency"
          />
        </ChartCard>

        <ChartCard :title="$t('charts.categoryTrend')">
          <CategoryTrendChart
            :transactions="transactionsStore.transactions"
            :currency="groupsStore.currentGroup.currency"
          />
        </ChartCard>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- DESKTOP VIEW (>= md) : Exactly as original, pristine & unchanged -->
    <!-- ============================================================ -->
    <div class="hidden md:block">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="md:col-span-2">
          <ChartCard
            :title="
              mode === 'split' ? $t('charts.yourBalanceOverTime') : $t('charts.balanceOverTime')
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
          <ChartCard :title="$t('charts.byCategory')">
            <CategoryBreakdownChart
              :transactions="transactionsStore.transactions"
              :currency="groupsStore.currentGroup.currency"
            />
          </ChartCard>
        </div>
        <div class="md:col-span-1">
          <ChartCard :title="mode === 'split' ? $t('charts.balances') : $t('charts.byMember')">
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
          :title="mode === 'split' ? $t('charts.monthlySpending') : $t('charts.monthlyCashFlow')"
        >
          <MonthlyCashFlowChart
            :transactions="transactionsStore.transactions"
            :currency="groupsStore.currentGroup.currency"
          />
        </ChartCard>
        <ChartCard :title="$t('charts.categoryTrend')">
          <CategoryTrendChart
            :transactions="transactionsStore.transactions"
            :currency="groupsStore.currentGroup.currency"
          />
        </ChartCard>
      </div>

      <div v-if="mode === 'split'" class="grid grid-cols-1 gap-4 mb-6">
        <ChartCard :title="$t('charts.everyonesBalance')">
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
            {{ $t('transactions.scanReceipt') }}
          </button>
          <TransactionForm
            :group-id="groupId"
            :group-currency="groupsStore.currentGroup.currency"
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
            :group-currency="groupsStore.currentGroup.currency"
            :transactions="transactionsStore.transactions"
            :members="groupsStore.currentGroup.members"
            :custom-categories="customCategories"
            :mode="mode"
            @export="showExport = true"
          />
        </div>
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
    :group-currency="groupsStore.currentGroup.currency"
    :custom-categories="customCategories"
    :mode="mode"
    :members="groupsStore.currentGroup.members"
    :current-user-id="authStore.user?.uid"
  />
  <ExportDialog
    v-if="groupsStore.currentGroup"
    v-model="showExport"
    :group="groupsStore.currentGroup"
    :transactions="transactionsStore.transactions"
    :members="groupsStore.currentGroup.members"
    :custom-categories="customCategories"
    :mode="mode"
  />
  <ImportDialog
    v-if="groupsStore.currentGroup"
    v-model="showImport"
    :group-id="groupId"
    :group="groupsStore.currentGroup"
    :members="groupsStore.currentGroup.members"
    :mode="mode"
  />
</template>
