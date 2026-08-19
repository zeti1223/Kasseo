<script setup>
import { onMounted, ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useGroupsStore } from "@/stores/groups";
import { useTransactionsStore } from "@/stores/transactions";
import { ref as dbRef, get } from "firebase/database";
import { db } from "@/services/firebase/config";
import CreateGroupDialog from "@/components/features/groups/CreateGroupDialog.vue";
import EmptyState from "@/components/features/dashboard/EmptyState.vue";
import FundsList from "@/components/features/dashboard/FundsList.vue";
import RecentActivity from "@/components/features/dashboard/RecentActivity.vue";

const router = useRouter();
const groupsStore = useGroupsStore();
const transactionsStore = useTransactionsStore();
const showCreateDialog = ref(false);
const recentTransactions = ref([]);
// Holds every transaction across every fund (unlike recentTransactions,
// which is just the top 5) so the chart has full history to plot.
const allTransactions = ref([]);
const loadingTransactions = ref(false);

onMounted(() => {
  groupsStore.listenToMyGroups();
  loadRecentTransactions();
});

watch(
  () => groupsStore.groups,
  () => {
    loadRecentTransactions();
  },
  { deep: true },
);

async function loadRecentTransactions() {
  if (groupsStore.groups.length === 0) return;

  loadingTransactions.value = true;
  try {
    const fetched = [];

    for (const group of groupsStore.groups) {
      const snap = await get(dbRef(db, `transactions/${group.id}`));
      if (snap.exists()) {
        const txs = Object.entries(snap.val()).map(([id, tx]) => ({
          id,
          ...tx,
          groupId: group.id,
          groupName: group.name,
          groupCurrency: group.currency,
        }));
        fetched.push(...txs);
      }
    }

    const sorted = fetched.sort((a, b) => new Date(b.date) - new Date(a.date));
    allTransactions.value = sorted;
    recentTransactions.value = sorted.slice(0, 5);
  } catch (error) {
    console.error("Error loading recent transactions:", error);
  } finally {
    loadingTransactions.value = false;
  }
}

const groupStats = computed(() => {
  return groupsStore.groups.map((group) => {
    const groupTxs = allTransactions.value.filter(
      (t) => t.groupId === group.id,
    );
    const deposited = groupTxs
      .filter((t) => t.type === "deposit")
      .reduce((sum, t) => sum + t.amount, 0);
    const spent = groupTxs
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const memberCount = group.members ? Object.keys(group.members).length : 0;

    return {
      ...group,
      balance: deposited - spent,
      memberCount,
    };
  });
});

function openGroup(id) {
  router.push({ name: "group", params: { id } });
}
</script>

<template>
  <div class="max-w-[1200px] mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6 flex-wrap gap-2">
      <div>
        <h1 class="text-2xl font-bold font-display dark:text-white">
          Welcome back!
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Here's what's happening with your shared funds
        </p>
      </div>
      <button
        @click="showCreateDialog = true"
        class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
      >
        <i class="fas fa-plus"></i>
        New fund
      </button>
    </div>

    <EmptyState
      v-if="groupsStore.groups.length === 0"
      @create="showCreateDialog = true"
    />

    <template v-else>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          <FundsList
            :groups="groupStats"
            @open="openGroup"
          />
        </div>

        <div class="lg:col-span-1">
          <RecentActivity
            :transactions="recentTransactions"
            :loading="loadingTransactions"
            @open="openGroup"
          />
        </div>
      </div>
    </template>

    <CreateGroupDialog v-model="showCreateDialog" />
  </div>
</template>
