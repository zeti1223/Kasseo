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

// Runs `fn` over `items` with at most `limit` in flight at once. Used
// for the currency reconversion below — firing every rate lookup at
// the same instant is what triggers a free, unauthenticated API to
// throttle or drop some of the requests in the first place.
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

// Every transaction keeps the currency and value it was entered in
// bound together (`originalAmount`/`originalCurrency`), alongside
// `amount`: the same value converted into the fund's currency using the
// exchange rate on the transaction's date. All balance/chart math in the
// app reads `amount`, so a transaction's contribution never silently
// changes just because the fund's currency changes later — instead,
// `recalculateForCurrency` explicitly redoes the conversion for every
// transaction when that happens (see FundSettingsDialog).
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
      description,
      date,
      splitAmong,
      splitType,
      splitShares,
      to,
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
    // Split-mode expense: who the cost is shared between (snapshot of
    // member ids at the time it was logged), and how — evenly, or by
    // `splitShares` (id -> percent of the total) when `splitType` is
    // "percent".
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

  async function updateTransaction(
    groupId,
    txId,
    groupCurrency,
    {
      amount,
      currency,
      type,
      category,
      description,
      date,
      paidBy,
      splitAmong,
      splitType,
      splitShares,
      to,
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

  // Re-converts every transaction in the fund into `newCurrency`, each
  // using the exchange rate on *that transaction's own date* — not
  // today's rate — so history stays accurate instead of everything
  // just being relabeled. Transactions saved before this feature existed
  // (no originalCurrency recorded) are assumed to have been entered in
  // whatever the fund's currency was previously.
  //
  // Rate lookups are deduped by (date, fromCurrency) and run with a
  // capped concurrency — with many transactions this is what keeps the
  // fund's currency switch from taking forever (and looking frozen)
  // without firing so many requests at once that the free rate API
  // throttles or drops some of them.
  //
  // onProgress(done, total), if given, is called as each transaction's
  // conversion resolves. Returns the list of transaction ids that
  // couldn't be converted (e.g. after retries were exhausted), so the
  // caller can warn the user and offer to retry just those.
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
    updateTransaction,
    recalculateForCurrency,
  };
});
