import { defineStore } from "pinia";
import { ref } from "vue";
import {
  ref as dbRef,
  push,
  set,
  remove,
  onValue,
  serverTimestamp,
} from "firebase/database";
import { db } from "@/firebase/config";
import { useAuthStore } from "./auth";

function categoryFor(type, category) {
  if (type === "expense") return category;
  if (type === "settlement") return "Settlement";
  return "Deposit";
}

export const useTransactionsStore = defineStore("transactions", () => {
  const transactions = ref([]);
  let unsubscribe = null;

  function listen(groupId) {
    if (unsubscribe) unsubscribe();
    const txRef = dbRef(db, `transactions/${groupId}`);
    unsubscribe = onValue(txRef, (snapshot) => {
      const val = snapshot.val() || {};
      transactions.value = Object.entries(val)
        .map(([id, tx]) => ({ id, ...tx }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    });
  }

  function stop() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    transactions.value = [];
  }

  async function addTransaction(
    groupId,
    { amount, type, category, description, date, splitAmong, to },
  ) {
    const authStore = useAuthStore();
    const newRef = push(dbRef(db, `transactions/${groupId}`));
    const payload = {
      amount: Number(amount),
      type, // 'expense' | 'deposit' | 'settlement'
      category: categoryFor(type, category),
      description: description || "",
      paidBy: authStore.user.uid, // for 'settlement', the member who paid their share
      date,
      createdAt: serverTimestamp(),
    };
    // Split-mode expense: who the cost is shared between (snapshot of
    // member ids at the time it was logged).
    if (type === "expense" && splitAmong?.length) {
      payload.splitAmong = splitAmong;
    }
    // Split-mode settlement: who received the direct payment.
    if (type === "settlement" && to) {
      payload.to = to;
    }
    await set(newRef, payload);
  }

  async function deleteTransaction(groupId, txId) {
    await remove(dbRef(db, `transactions/${groupId}/${txId}`));
  }

  async function updateTransaction(
    groupId,
    txId,
    { amount, type, category, description, date, paidBy, splitAmong, to },
  ) {
    const payload = {
      amount: Number(amount),
      type,
      category: categoryFor(type, category),
      description: description || "",
      paidBy,
      date,
    };
    if (type === "expense" && splitAmong?.length) {
      payload.splitAmong = splitAmong;
    }
    if (type === "settlement" && to) {
      payload.to = to;
    }
    await set(dbRef(db, `transactions/${groupId}/${txId}`), payload);
  }

  return {
    transactions,
    listen,
    stop,
    addTransaction,
    deleteTransaction,
    updateTransaction,
  };
});
