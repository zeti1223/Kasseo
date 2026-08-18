<script setup>
import { computed, ref } from "vue";
import { useTransactionsStore } from "@/stores/transactions";
import { useAuthStore } from "@/stores/auth";
import { splitShareAmount } from "@/utils/chartData";
import EditTransactionDialog from "./EditTransactionDialog.vue";
import ConfirmDialog from "../../common/ConfirmDialog.vue";

const props = defineProps({
  groupId: { type: String, required: true },
  groupCurrency: { type: String, required: true },
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
  customCategories: { type: Array, default: () => [] },
  mode: { type: String, default: "kitty" }, // 'kitty' | 'split'
});
const transactionsStore = useTransactionsStore();
const authStore = useAuthStore();

const sorted = computed(() => [...props.transactions].reverse());
const editingTransaction = ref(null);
const showEditDialog = ref(false);
const showPermissionAlert = ref(false);
const permissionTx = ref(null);

function memberName(uid) {
  return props.members?.[uid]?.displayName || "Someone";
}

function handleDelete(txId) {
  transactionsStore.deleteTransaction(props.groupId, txId);
}

function canEdit(tx) {
  return tx.paidBy === authStore.user?.uid;
}

function handleEdit(tx) {
  if (canEdit(tx)) {
    editingTransaction.value = tx;
    showEditDialog.value = true;
  } else {
    permissionTx.value = tx;
    showPermissionAlert.value = true;
  }
}

// Split-mode context: how a given expense relates to the signed-in
// member, e.g. "You owe 5.00" or "You're owed 10.00".
function splitInfo(tx) {
  if (props.mode !== "split" || tx.type !== "expense") return null;
  const uid = authStore.user?.uid;
  if (!uid) return null;
  const participants = tx.splitAmong?.length
    ? tx.splitAmong
    : Object.keys(props.members);
  if (!participants.includes(uid)) return null;

  const share = splitShareAmount(tx, uid, participants);
  if (tx.paidBy === uid) {
    const owedToYou = tx.amount - share;
    if (owedToYou < 0.005) return { text: "Your share only", tone: "muted" };
    return { text: `You're owed ${owedToYou.toFixed(2)}`, tone: "positive" };
  }
  return { text: `You owe ${share.toFixed(2)}`, tone: "negative" };
}

// Shown as a small note when a transaction was entered in a different
// currency than the fund's, so the converted amount above it isn't a
// mystery.
function originalAmountLabel(tx) {
  if (!tx.originalCurrency || tx.originalCurrency === props.groupCurrency) {
    return null;
  }
  return `${tx.originalAmount.toFixed(2)} ${tx.originalCurrency}`;
}

function splitBetweenLabel(tx) {
  const participants = tx.splitAmong?.length
    ? tx.splitAmong
    : Object.keys(props.members);
  const uid = authStore.user?.uid;
  return participants
    .map((id) => {
      const name = id === uid ? "you" : memberName(id);
      if (tx.splitType === "percent" && tx.splitShares) {
        const pct = Number(tx.splitShares[id] || 0);
        return `${name} (${pct}%)`;
      }
      return name;
    })
    .join(", ");
}
</script>

<template>
  <div
    class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
  >
    <div class="text-base font-medium mb-3 font-display dark:text-white">
      Transactions
    </div>

    <div
      v-if="!transactions.length"
      class="bg-[#A5E3FC]/20 border border-[#A5E3FC] text-[#A5E3FC] rounded-lg p-3"
    >
      No transactions yet — log the first
      {{ mode === "split" ? "expense" : "deposit or expense" }} to get started.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="tx in sorted"
        :key="tx.id"
        class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div
          :class="
            tx.type === 'deposit'
              ? 'bg-[#A7F49D]'
              : tx.type === 'settlement'
                ? 'bg-[#A5E3FC]'
                : 'bg-[#C1503A]'
          "
          class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        >
          <i
            :class="[
              'text-white',
              tx.type === 'deposit'
                ? 'fas fa-arrow-down'
                : tx.type === 'settlement'
                  ? 'fas fa-handshake'
                  : 'fas fa-arrow-up',
            ]"
          ></i>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-start">
            <span class="font-medium truncate dark:text-white">
              <template v-if="tx.type === 'settlement'">
                {{ memberName(tx.paidBy) }} paid {{ memberName(tx.to) }}
              </template>
              <template v-else>
                {{ tx.description || tx.category }}
              </template>
            </span>
            <span
              class="font-bold money dark:text-white"
              :class="
                tx.type === 'deposit'
                  ? 'text-[#A7F49D]'
                  : tx.type === 'settlement'
                    ? 'text-[#5C7A99] dark:text-[#A5E3FC]'
                    : 'text-[#C1503A]'
              "
            >
              {{
                tx.type === "deposit"
                  ? "+"
                  : tx.type === "settlement"
                    ? ""
                    : "-"
              }}{{ tx.amount.toFixed(2) }}
              <span
                v-if="originalAmountLabel(tx)"
                class="font-normal text-xs text-gray-400 dark:text-gray-500"
                >({{ originalAmountLabel(tx) }})</span
              >
            </span>
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            <template v-if="tx.type === 'settlement'">
              {{ tx.date }}{{ tx.description ? ` · ${tx.description}` : "" }}
            </template>
            <template v-else>
              {{ tx.date }} ·
              <span class="dark:text-gray-300">{{
                memberName(tx.paidBy)
              }}</span>
              · <span class="dark:text-gray-300">{{ tx.category }}</span>
            </template>
          </div>
          <div
            v-if="mode === 'split' && tx.type === 'expense'"
            class="text-xs text-gray-400 dark:text-gray-500 mt-0.5"
          >
            Split between {{ splitBetweenLabel(tx) }}
            <span
              v-if="splitInfo(tx)"
              class="ml-1 font-medium"
              :class="{
                'text-[#3FA34D] dark:text-[#A7F49D]':
                  splitInfo(tx).tone === 'positive',
                'text-[#C1503A]': splitInfo(tx).tone === 'negative',
              }"
              >· {{ splitInfo(tx).text }}</span
            >
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button
            @click="handleEdit(tx)"
            class="text-gray-400 hover:text-[#C8A5FC] transition-colors p-1"
            :class="{ 'opacity-50': !canEdit(tx) }"
          >
            <i class="fas fa-edit"></i>
          </button>
          <button
            @click="handleDelete(tx.id)"
            class="text-gray-400 hover:text-red-500 transition-colors p-1"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <EditTransactionDialog
      v-model="showEditDialog"
      :transaction="editingTransaction"
      :group-id="groupId"
      :group-currency="groupCurrency"
      :custom-categories="customCategories"
      :mode="mode"
      :members="members"
      :current-user-id="authStore.user?.uid"
    />

    <!-- Permission Alert Dialog -->
    <ConfirmDialog
      v-model="showPermissionAlert"
      title="Permission Required"
      confirm-label="Got it"
      :show-cancel="false"
      @confirm="showPermissionAlert = false"
    >
      <p class="mb-3">
        You can only edit transactions you created. This transaction was created
        by <strong>{{ memberName(permissionTx?.paidBy) }}</strong
        >.
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        If you need to edit this transaction, please ask
        {{ memberName(permissionTx?.paidBy) }} to make the changes or contact
        your group administrator.
      </p>
    </ConfirmDialog>
  </div>
</template>
