import { defineStore } from "pinia";
import { ref } from "vue";
import {
  ref as dbRef,
  push,
  set,
  get,
  update,
  remove,
  onValue,
  serverTimestamp,
} from "firebase/database";
import { db } from "@/services/firebase/config";
import { useAuthStore } from "./auth";
import { convertCurrency } from "@/services/currency";

// Runs `fn` over `items` with at most `limit` calls in flight (avoids
// overwhelming the free, unauthenticated rate API).
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

function categoryFor(type, category) {
  if (type === "expense") return category;
  if (type === "settlement") return "Settlement";
  return "Deposit";
}

// Converts `amount` into the fund's currency, keeping the original
// value/currency alongside the converted `amount` used for balance/chart math.
async function buildConversionFields(groupCurrency, amount, currency, date) {
  const originalAmount = Number(amount);
  const originalCurrency = currency || groupCurrency;
  const { amount: converted, rateDate } = await convertCurrency(
    originalAmount,
    originalCurrency,
    groupCurrency,
    date,
  );
  return {
    amount: converted,
    originalAmount,
    originalCurrency,
    baseCurrency: groupCurrency,
    convertedAt: rateDate,
  };
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
    groupCurrency,
    {
      amount,
      currency,
      type,
      category,
      categoryIcon,
      description,
      date,
      splitAmong,
      splitType,
      splitShares,
      to,
      receiptId,
      splitOption,
    },
  ) {
    const authStore = useAuthStore();
    const newRef = push(dbRef(db, `transactions/${groupId}`));
    const conversion = await buildConversionFields(
      groupCurrency,
      amount,
      currency,
      date,
    );
    const payload = {
      ...conversion,
      type, // 'expense' | 'deposit' | 'settlement'
      category: categoryFor(type, category),
      description: description || "",
      paidBy: authStore.user.uid, // for 'settlement', the member who paid their share
      date,
      createdAt: serverTimestamp(),
    };
    if (categoryIcon) payload.categoryIcon = categoryIcon;
    if (receiptId) payload.receiptId = receiptId;
    if (splitOption) payload.splitOption = splitOption;
    // Split-mode expense: who the cost is split between, and how
    // (evenly, or by `splitShares` percentages).
    if (type === "expense" && splitAmong?.length) {
      payload.splitAmong = splitAmong;
      if (splitType === "percent" && splitShares) {
        payload.splitType = "percent";
        payload.splitShares = splitShares;
      }
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

  async function deleteReceiptGroup(groupId, receiptId) {
    const matched = transactions.value.filter((t) => t.receiptId === receiptId);
    if (!matched.length) return;
    const updates = {};
    for (const tx of matched) {
      updates[tx.id] = null;
    }
    await update(dbRef(db, `transactions/${groupId}`), updates);
  }

  async function updateReceiptGroupSplitOption(
    groupId,
    receiptId,
    newSplitOption,
    members,
  ) {
    const matched = transactions.value.filter((t) => t.receiptId === receiptId);
    if (!matched.length) return;
    const allMemberIds = Object.keys(members || {});
    const updates = {};
    for (const tx of matched) {
      updates[`${tx.id}/splitOption`] = newSplitOption;
      if (newSplitOption === "whole_group") {
        updates[`${tx.id}/splitAmong`] = allMemberIds;
      }
    }
    await update(dbRef(db, `transactions/${groupId}`), updates);
  }

  async function updateTransaction(
    groupId,
    txId,
    groupCurrency,
    {
      amount,
      currency,
      type,
      category,
      categoryIcon,
      description,
      date,
      paidBy,
      splitAmong,
      splitType,
      splitShares,
      to,
      receiptId,
      splitOption,
    },
  ) {
    const conversion = await buildConversionFields(
      groupCurrency,
      amount,
      currency,
      date,
    );
    const payload = {
      ...conversion,
      type,
      category: categoryFor(type, category),
      description: description || "",
      paidBy,
      date,
    };
    if (categoryIcon) payload.categoryIcon = categoryIcon;
    if (receiptId) payload.receiptId = receiptId;
    if (splitOption) payload.splitOption = splitOption;
    if (type === "expense" && splitAmong?.length) {
      payload.splitAmong = splitAmong;
      if (splitType === "percent" && splitShares) {
        payload.splitType = "percent";
        payload.splitShares = splitShares;
      }
    }
    if (type === "settlement" && to) {
      payload.to = to;
    }
    await set(dbRef(db, `transactions/${groupId}/${txId}`), payload);
  }

  // Re-converts every transaction into `newCurrency` using each
  // transaction's own historical rate, with capped concurrency.
  // onProgress(done, total) reports progress; returns ids that failed to convert.
  async function recalculateForCurrency(groupId, newCurrency, onProgress) {
    const snap = await get(dbRef(db, `transactions/${groupId}`));
    if (!snap.exists()) return [];
    const all = snap.val();
    const entries = Object.entries(all);
    const total = entries.length;
    let done = 0;

    const results = await mapWithConcurrency(entries, 4, async ([id, tx]) => {
      const fromCurrency =
        tx.originalCurrency || tx.baseCurrency || newCurrency;
      const fromAmount = tx.originalAmount ?? tx.amount;
      try {
        const { amount: converted, rateDate } = await convertCurrency(
          fromAmount,
          fromCurrency,
          newCurrency,
          tx.date,
        );
        return {
          id,
          ok: true,
          fields: {
            [`${id}/amount`]: converted,
            [`${id}/originalAmount`]: fromAmount,
            [`${id}/originalCurrency`]: fromCurrency,
            [`${id}/baseCurrency`]: newCurrency,
            [`${id}/convertedAt`]: rateDate,
          },
        };
      } catch (err) {
        console.error(`Couldn't reconvert transaction ${id}:`, err);
        return { id, ok: false };
      } finally {
        done += 1;
        onProgress?.(done, total);
      }
    });

    const updates = Object.assign(
      {},
      ...results.filter((r) => r.ok).map((r) => r.fields),
    );

    if (Object.keys(updates).length) {
      await update(dbRef(db, `transactions/${groupId}`), updates);
    }

    return results.filter((r) => !r.ok).map((r) => r.id);
  }

  return {
    transactions,
    listen,
    stop,
    addTransaction,
    deleteTransaction,
    deleteReceiptGroup,
    updateReceiptGroupSplitOption,
    updateTransaction,
    recalculateForCurrency,
  };
});
