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
    { amount, type, category, description, date },
  ) {
    const authStore = useAuthStore();
    const newRef = push(dbRef(db, `transactions/${groupId}`));
    await set(newRef, {
      amount: Number(amount),
      type, // 'expense' | 'deposit'
      category: type === "expense" ? category : "Deposit",
      description: description || "",
      paidBy: authStore.user.uid,
      date,
      createdAt: serverTimestamp(),
    });
  }

  async function deleteTransaction(groupId, txId) {
    await remove(dbRef(db, `transactions/${groupId}/${txId}`));
  }

  async function updateTransaction(
    groupId,
    txId,
    { amount, type, category, description, date, paidBy },
  ) {
    await set(dbRef(db, `transactions/${groupId}/${txId}`), {
      amount: Number(amount),
      type,
      category: type === "expense" ? category : "Deposit",
      description: description || "",
      paidBy,
      date,
    });
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
