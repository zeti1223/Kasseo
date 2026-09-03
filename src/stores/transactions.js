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
import { sendPushNotificationToUsers } from "@/services/notificationService";
import {
  getMonthRange,
  getCategorySpend,
  getNewlyCrossedThreshold,
} from "@/utils/budgets";
import { isOnline } from "@/services/offline/network";
import {
  cacheGet,
  cacheSet,
  queueAdd,
  mergeWithQueuedPending,
} from "@/services/offline/db";

// Note: title/body are always sent via i18n keys + params (titleKey/bodyKey)
// so notificationService can translate them into every recipient's own
// language (not the sender's). `body` (raw string) is for language-neutral
// content, e.g. a user-typed transaction description.
async function dispatchPushToGroupMembers(
  groupId,
  { titleKey, titleParams, body, bodyKey, bodyParams, data = {} },
) {
  try {
    const authStore = useAuthStore();
    const myUid = authStore.user?.uid;
    const groupSnap = await get(dbRef(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return;
    const group = groupSnap.val();
    const members = group.members || {};
    const recipientUids = Object.keys(members).filter((uid) => uid !== myUid);
    if (recipientUids.length === 0) return;

    await sendPushNotificationToUsers({
      recipientUids,
      titleKey,
      titleParams,
      body,
      bodyKey,
      bodyParams,
      data: { groupId, ...data },
    });
  } catch (err) {
    console.warn("Could not dispatch push to group members:", err);
  }
}

// Checks whether adding `addedAmount` to `categoryName` pushes that
// category's spend for the calendar month containing `date` across its 80%
// or 100% budget threshold for the first time. Returns
// `{ crossed, limit, spendAfter }` or null if there's no budget set, or the
// threshold was already crossed before this transaction.
async function checkBudgetThresholdCrossed(
  groupId,
  categoryName,
  addedAmount,
  date,
  currentTransactions,
) {
  try {
    const budgetsSnap = await get(
      dbRef(db, `groups/${groupId}/categoryBudgets`),
    );
    if (!budgetsSnap.exists()) return null;
    const budget = Object.values(budgetsSnap.val()).find(
      (b) => b?.name === categoryName,
    );
    if (!budget || !(Number(budget.amount) > 0)) return null;

    const limit = Number(budget.amount);
    const range = getMonthRange(new Date(date));
    const spendBefore = getCategorySpend(currentTransactions, categoryName, range);
    const crossed = getNewlyCrossedThreshold(spendBefore, addedAmount, limit);
    if (!crossed) return null;

    return { crossed, limit, spendAfter: spendBefore + addedAmount };
  } catch (err) {
    console.warn("Could not check category budget threshold:", err);
    return null;
  }
}

// Notifies every member of the fund (unlike other notifications, this
// includes the person who just added the expense — they need to know they
// just crossed their own fund's budget too) that a category budget hit a
// warning or exceeded threshold.
async function dispatchBudgetWarning(
  groupId,
  { categoryName, threshold, limit, spend, currency },
) {
  try {
    const groupSnap = await get(dbRef(db, `groups/${groupId}`));
    if (!groupSnap.exists()) return;
    const members = groupSnap.val().members || {};
    const allUids = Object.keys(members);
    if (allUids.length === 0) return;

    await sendPushNotificationToUsers({
      recipientUids: allUids,
      titleKey:
        threshold === "exceeded"
          ? "notifications.budgetExceeded"
          : "notifications.budgetWarning",
      titleParams: { category: categoryName },
      bodyKey: "notifications.budgetBody",
      bodyParams: {
        spend: Math.round(spend),
        limit: Math.round(limit),
        currency: currency || "",
      },
      data: {
        type: threshold === "exceeded" ? "budgetExceeded" : "budgetWarning",
        category: categoryName,
      },
    });
  } catch (err) {
    console.warn("Could not dispatch budget warning:", err);
  }
}

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

// Same as buildConversionFields, but never throws: if the exchange-rate API
// can't be reached (most commonly: offline, and no cached rate for this
// currency pair/date), the raw amount is stored unconverted rather than
// blocking the transaction from being added at all. `conversionPending`
// marks it so it can be corrected later once a rate is available.
async function safeBuildConversionFields(groupCurrency, amount, currency, date) {
  try {
    return await buildConversionFields(groupCurrency, amount, currency, date);
  } catch (err) {
    console.warn("Currency conversion failed, storing amount unconverted:", err);
    return {
      amount: Number(amount),
      originalAmount: Number(amount),
      originalCurrency: currency || groupCurrency,
      baseCurrency: groupCurrency,
      convertedAt: null,
      conversionPending: true,
    };
  }
}

// Merges the local transactions list with any writes still sitting in the
// offline queue for this group, so a transaction added while offline
// doesn't visually disappear the moment a fresh (queue-unaware) snapshot
// comes in from Firebase before the queue has had a chance to flush.
async function mergeGroupTransactionsWithQueue(groupId, list) {
  const merged = await mergeWithQueuedPending(`transactions/${groupId}`, list);
  return merged.sort((a, b) => new Date(a.date) - new Date(b.date));
}

export const useTransactionsStore = defineStore("transactions", () => {
  const transactions = ref([]);
  let unsubscribe = null;

  function listen(groupId) {
    if (unsubscribe) unsubscribe();

    const cacheKey = `transactions:${groupId}`;
    // Show the last-synced data immediately so the list isn't just empty
    // while offline or still reconnecting. A real snapshot from onValue
    // below always supersedes this once it arrives.
    cacheGet(cacheKey).then((cached) => {
      if (cached && transactions.value.length === 0) {
        transactions.value = cached;
      }
    });

    const txRef = dbRef(db, `transactions/${groupId}`);
    unsubscribe = onValue(txRef, (snapshot) => {
      const val = snapshot.val() || {};
      const list = Object.entries(val)
        .map(([id, tx]) => ({ id, ...tx }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      cacheSet(cacheKey, list);
      mergeGroupTransactionsWithQueue(groupId, list).then((merged) => {
        transactions.value = merged;
      });
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
      notify = true,
    },
  ) {
    const authStore = useAuthStore();
    const newRef = push(dbRef(db, `transactions/${groupId}`));
    const conversion = await safeBuildConversionFields(
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
    // Snapshot spend *before* this transaction is written, so the threshold
    // check below isn't thrown off by the realtime listener possibly having
    // already echoed this same write back into `transactions.value`.
    const preWriteTransactions = transactions.value;

    if (!isOnline.value) {
      // Offline: apply the change locally right away and queue the actual
      // write instead of blocking on (or failing) a network call. `push()`
      // above already generated the id purely client-side, so this is safe
      // to do without a connection.
      transactions.value = [
        ...transactions.value,
        { id: newRef.key, ...payload, pending: true },
      ].sort((a, b) => new Date(a.date) - new Date(b.date));
      await queueAdd({
        kind: "set",
        path: `transactions/${groupId}/${newRef.key}`,
        payload,
      });
      return newRef.key;
    }

    await set(newRef, payload);

    if (notify) {
      const myName =
        authStore.userProfile?.nickname || authStore.user?.displayName;
      dispatchPushToGroupMembers(groupId, {
        titleKey: "notifications.transactionAdded",
        titleParams: { name: myName },
        body: description || category || "",
        data: { type: "transactionAdded" },
      });
    }

    if (type === "expense") {
      const budgetAlert = await checkBudgetThresholdCrossed(
        groupId,
        payload.category,
        conversion.amount,
        date,
        preWriteTransactions,
      );
      if (budgetAlert) {
        dispatchBudgetWarning(groupId, {
          categoryName: payload.category,
          threshold: budgetAlert.crossed,
          limit: budgetAlert.limit,
          spend: budgetAlert.spendAfter,
          currency: groupCurrency,
        });
      }
    }

    return newRef.key;
  }

  // Sends a single push notification for a whole scanned receipt, instead
  // of one per line item (each item is saved via addTransaction with
  // notify: false, then this is called once after the loop).
  function notifyReceiptScanned(groupId, itemCount) {
    const authStore = useAuthStore();
    const myName =
      authStore.userProfile?.nickname || authStore.user?.displayName;
    dispatchPushToGroupMembers(groupId, {
      titleKey: "notifications.receiptScanned",
      titleParams: { name: myName },
      bodyKey: "notifications.receiptScannedBody",
      bodyParams: { count: itemCount },
      data: { type: "receiptScanned" },
    });
  }

  async function deleteTransaction(groupId, txId) {
    const tx = transactions.value.find((t) => t.id === txId);

    if (!isOnline.value) {
      transactions.value = transactions.value.filter((t) => t.id !== txId);
      await queueAdd({ kind: "remove", path: `transactions/${groupId}/${txId}` });
      return;
    }

    await remove(dbRef(db, `transactions/${groupId}/${txId}`));
    dispatchPushToGroupMembers(groupId, {
      titleKey: "notifications.transactionDeleted",
      body: tx?.description || tx?.category || "",
      data: { type: "transactionDeleted" },
    });
  }

  async function deleteReceiptGroup(groupId, receiptId) {
    const matched = transactions.value.filter((t) => t.receiptId === receiptId);
    if (!matched.length) return;
    const updates = {};
    for (const tx of matched) {
      updates[tx.id] = null;
    }
    await update(dbRef(db, `transactions/${groupId}`), updates);
    dispatchPushToGroupMembers(groupId, {
      titleKey: "notifications.transactionDeleted",
      data: { type: "transactionDeleted" },
    });
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
    const conversion = await safeBuildConversionFields(
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

    if (!isOnline.value) {
      transactions.value = transactions.value
        .map((t) => (t.id === txId ? { id: txId, ...payload, pending: true } : t))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      await queueAdd({
        kind: "set",
        path: `transactions/${groupId}/${txId}`,
        payload,
      });
      return;
    }

    await set(dbRef(db, `transactions/${groupId}/${txId}`), payload);

    const authStore = useAuthStore();
    const myName =
      authStore.userProfile?.nickname || authStore.user?.displayName;
    dispatchPushToGroupMembers(groupId, {
      titleKey: "notifications.transactionEdited",
      titleParams: { name: myName },
      body: description || category || "",
      data: { type: "transactionEdited" },
    });
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

  // Re-categorizes every transaction that references `oldCategoryName` to
  // `newCategoryName`, and drops any custom `categoryIcon` so the icon
  // falls back to the new category's default (an old custom icon painted
  // on the deleted category would otherwise stick around and look wrong).
  // Used when a custom category is deleted, so its transactions don't end
  // up silently orphaned with a category name that no longer exists.
  async function reassignCategory(groupId, oldCategoryName, newCategoryName) {
    const matched = transactions.value.filter(
      (t) => t.type === "expense" && t.category === oldCategoryName,
    );
    if (!matched.length) return 0;
    const updates = {};
    for (const tx of matched) {
      updates[`${tx.id}/category`] = newCategoryName;
      updates[`${tx.id}/categoryIcon`] = null;
    }
    await update(dbRef(db, `transactions/${groupId}`), updates);
    return matched.length;
  }

  // Imports a batch of parsed transactions into a group, converting currencies and mapping members
  async function importTransactionsBatch(
    groupId,
    groupCurrency,
    importedTransactions = [],
    memberMap = {},
    { onProgress } = {},
  ) {
    const authStore = useAuthStore();
    const currentUid = authStore.user?.uid;
    const total = importedTransactions.length;
    if (total === 0) return 0;

    let done = 0;

    // Process and convert all transactions with concurrency
    const batchEntries = await mapWithConcurrency(
      importedTransactions,
      4,
      async (rawTx) => {
        try {
          const conversion = await buildConversionFields(
            groupCurrency,
            rawTx.amount,
            rawTx.currency || groupCurrency,
            rawTx.date,
          );

          const type = rawTx.type || "expense";
          const paidBy =
            memberMap[rawTx.paidByName] ||
            memberMap[rawTx.paidBy] ||
            currentUid;

          const txPayload = {
            ...conversion,
            type,
            category: categoryFor(type, rawTx.category),
            description: rawTx.description || "",
            paidBy,
            date: rawTx.date,
            createdAt: serverTimestamp(),
          };

          if (rawTx.categoryIcon) txPayload.categoryIcon = rawTx.categoryIcon;
          if (rawTx.receiptId) txPayload.receiptId = rawTx.receiptId;
          if (rawTx.splitOption) txPayload.splitOption = rawTx.splitOption;

          if (type === "expense") {
            const rawSplit = rawTx.splitAmongNames || rawTx.splitAmong || [];
            const mappedSplit = rawSplit
              .map((nameOrId) => memberMap[nameOrId] || nameOrId)
              .filter(Boolean);

            if (mappedSplit.length > 0) {
              txPayload.splitAmong = Array.from(new Set(mappedSplit));
            }

            if (rawTx.splitType === "percent" && rawTx.splitShares) {
              const mappedShares = {};
              for (const [nameOrId, pct] of Object.entries(rawTx.splitShares)) {
                const mappedId = memberMap[nameOrId] || nameOrId;
                if (mappedId) {
                  mappedShares[mappedId] = pct;
                }
              }
              if (Object.keys(mappedShares).length > 0) {
                txPayload.splitType = "percent";
                txPayload.splitShares = mappedShares;
              }
            }
          } else if (type === "settlement") {
            const to =
              memberMap[rawTx.toName] ||
              memberMap[rawTx.to] ||
              null;
            if (to) {
              txPayload.to = to;
            }
          }

          const newTxRef = push(dbRef(db, `transactions/${groupId}`));
          const txId = newTxRef.key;

          return { txId, txPayload, ok: true };
        } catch (err) {
          console.error("Error preparing transaction for import:", err);
          return { ok: false };
        } finally {
          done++;
          onProgress?.(done, total);
        }
      },
    );

    const updates = {};
    let count = 0;
    for (const entry of batchEntries) {
      if (entry && entry.ok && entry.txId && entry.txPayload) {
        updates[`${entry.txId}`] = entry.txPayload;
        count++;
      }
    }

    if (Object.keys(updates).length > 0) {
      await update(dbRef(db, `transactions/${groupId}`), updates);
    }

    return count;
  }

  return {
    transactions,
    listen,
    stop,
    addTransaction,
    notifyReceiptScanned,
    deleteTransaction,
    deleteReceiptGroup,
    updateReceiptGroupSplitOption,
    updateTransaction,
    recalculateForCurrency,
    reassignCategory,
    importTransactionsBatch,
  };
});
