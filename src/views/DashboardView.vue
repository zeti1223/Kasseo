<script setup>
import { onMounted, ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useGroupsStore } from "@/stores/groups";
import { useTransactionsStore } from "@/stores/transactions";
import { ref as dbRef, get } from "firebase/database";
import { db } from "@/firebase/config";
import CreateGroupDialog from "@/components/CreateGroupDialog.vue";
import StatCard from "@/components/StatCard.vue";

const router = useRouter();
const groupsStore = useGroupsStore();
const transactionsStore = useTransactionsStore();
const showCreateDialog = ref(false);
const copiedId = ref(null);
const recentTransactions = ref([]);
const loadingTransactions = ref(false);

onMounted(() => {
  groupsStore.listenToMyGroups();
  loadRecentTransactions();
});

watch(() => groupsStore.groups, () => {
  loadRecentTransactions();
}, { deep: true });

async function loadRecentTransactions() {
  if (groupsStore.groups.length === 0) return;

  loadingTransactions.value = true;
  try {
    const allTransactions = [];

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
        allTransactions.push(...txs);
      }
    }

    recentTransactions.value = allTransactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  } catch (error) {
    console.error("Error loading recent transactions:", error);
  } finally {
    loadingTransactions.value = false;
  }
}

const aggregateStats = computed(() => {
  if (groupsStore.groups.length === 0) {
    return {
      totalBalance: 0,
      totalDeposited: 0,
      totalSpent: 0,
      currency: "USD",
    };
  }

  let totalDeposited = 0;
  let totalSpent = 0;
  const currency = groupsStore.groups[0]?.currency || "USD";

  for (const group of groupsStore.groups) {
    for (const tx of recentTransactions.value.filter(
      (t) => t.groupId === group.id,
    )) {
      if (tx.type === "deposit") {
        totalDeposited += tx.amount;
      } else if (tx.type === "expense") {
        totalSpent += tx.amount;
      }
    }
  }

  return {
    totalBalance: totalDeposited - totalSpent,
    totalDeposited,
    totalSpent,
    currency,
  };
});

const groupStats = computed(() => {
  return groupsStore.groups.map((group) => {
    const groupTxs = recentTransactions.value.filter(
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

async function copyInviteLink(id) {
  const url = `${window.location.origin}/join/${id}`;
  await navigator.clipboard.writeText(url);
  copiedId.value = id;
  setTimeout(() => (copiedId.value = null), 2000);
}

function formatCurrency(amount, currency) {
  return `${amount.toFixed(2)} ${currency}`;
}

function getTransactionIcon(type) {
  return type === "deposit" ? "arrow-down" : "arrow-up";
}

function getTransactionColor(type) {
  return type === "deposit" ? "success" : "error";
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

    <!-- Empty State -->
    <div
      v-if="groupsStore.groups.length === 0"
      class="bg-gradient-to-r from-[#A5E3FC]/20 to-[#C8A5FC]/20 border border-[#A5E3FC]/50 rounded-lg p-8 mb-6 text-center"
    >
      <div class="max-w-md mx-auto">
        <div
          class="w-16 h-16 bg-[#A5E3FC]/30 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <i class="fas fa-coins w-8 h-8 text-[#A5E3FC]"></i>
        </div>
        <h2 class="text-xl font-semibold mb-2 dark:text-white">
          Start your shared fund journey
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          Create your first shared fund to track expenses with friends, family,
          or roommates.
        </p>
        <button
          @click="showCreateDialog = true"
          class="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors"
        >
          Create your first fund
        </button>
      </div>
    </div>

    <template v-else>
      <!-- Aggregate Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total balance across all funds"
          :value="aggregateStats.totalBalance"
          :currency="aggregateStats.currency"
          color="primary"
          icon="piggy-bank"
        />
        <StatCard
          label="Total deposited"
          :value="aggregateStats.totalDeposited"
          :currency="aggregateStats.currency"
          color="success"
          icon="arrow-down"
        />
        <StatCard
          label="Total spent"
          :value="aggregateStats.totalSpent"
          :currency="aggregateStats.currency"
          color="error"
          icon="arrow-up"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Funds List -->
        <div class="lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold font-display dark:text-white">
              Your shared funds
            </h2>
            <span class="text-sm text-gray-500 dark:text-gray-400"
              >{{ groupsStore.groups.length }} fund{{
                groupsStore.groups.length !== 1 ? "s" : ""
              }}</span
            >
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              v-for="group in groupStats"
              :key="group.id"
              class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col cursor-pointer hover:shadow-md transition-shadow"
              @click="openGroup(group.id)"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                  <div
                    class="text-lg font-semibold mb-1 font-display dark:text-white"
                  >
                    {{ group.name }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ group.currency }} • {{ group.memberCount }} member{{
                      group.memberCount !== 1 ? "s" : ""
                    }}
                  </div>
                </div>
                <div class="text-right">
                  <div
                    class="text-lg font-bold dark:text-white"
                    :class="
                      group.balance >= 0 ? 'text-[#A7F49D]' : 'text-[#C1503A]'
                    "
                  >
                    {{ formatCurrency(group.balance, group.currency) }}
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    Current balance
                  </div>
                </div>
              </div>

              <div class="flex-1" />
              <div class="flex items-center gap-2 mt-3">
                <button
                  @click.stop="copyInviteLink(group.id)"
                  class="flex-1 text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 dark:text-white"
                >
                  <i class="fas fa-link w-4 h-4"></i>
                  {{ copiedId === group.id ? "Copied!" : "Share" }}
                </button>
                <button
                  @click.stop="openGroup(group.id)"
                  class="flex-1 text-sm px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                >
                  <i class="fas fa-arrow-right w-4 h-4"></i>
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="lg:col-span-1">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold font-display dark:text-white">
              Recent activity
            </h2>
            <span
              v-if="loadingTransactions"
              class="text-sm text-gray-500 dark:text-gray-400"
              >Loading...</span
            >
          </div>

          <div
            class="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <div
              v-if="recentTransactions.length === 0 && !loadingTransactions"
              class="p-6 text-center text-gray-500 dark:text-gray-400"
            >
              <i class="fas fa-clipboard-list w-8 h-8 mx-auto mb-2 opacity-50"></i>
              No recent activity
            </div>

            <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
              <div
                v-for="tx in recentTransactions"
                :key="tx.id"
                class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                @click="openGroup(tx.groupId)"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    :class="
                      tx.type === 'deposit'
                        ? 'bg-[#A7F49D]/20'
                        : 'bg-[#C1503A]/20'
                    "
                  >
                    <i
                      :class="[
                        'w-4 h-4',
                        tx.type === 'deposit'
                          ? 'fas fa-arrow-down text-[#A7F49D]'
                          : 'fas fa-arrow-up text-[#C1503A]'
                      ]"
                    ></i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <div class="font-medium text-sm dark:text-white truncate">
                        {{ tx.description || tx.category }}
                      </div>
                      <div
                        class="text-sm font-semibold dark:text-white"
                        :class="
                          tx.type === 'deposit'
                            ? 'text-[#A7F49D]'
                            : 'text-[#C1503A]'
                        "
                      >
                        {{ tx.type === "deposit" ? "+" : "-"
                        }}{{ formatCurrency(tx.amount, tx.groupCurrency) }}
                      </div>
                    </div>
                    <div
                      class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
                    >
                      <div class="truncate">{{ tx.groupName }}</div>
                      <div>{{ new Date(tx.date).toLocaleDateString() }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <CreateGroupDialog v-model="showCreateDialog" />
  </div>
</template>
