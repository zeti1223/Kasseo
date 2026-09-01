import { defineStore } from "pinia";
import { ref } from "vue";
import {
  ref as dbRef,
  push,
  set,
  get,
  update,
  onValue,
  serverTimestamp,
  remove,
} from "firebase/database";
import { db } from "@/services/firebase/config";
import { useAuthStore } from "./auth";
import { useTransactionsStore } from "./transactions";
import { sendPushNotificationToUsers } from "@/services/notificationService";
import { categoryBudgetKey } from "@/utils/budgets";
import { cacheGet, cacheSet, withTimeout } from "@/services/offline/db";

// Note: title/body are always sent via i18n keys + params (titleKey/bodyKey)
// so notificationService can translate them into every recipient's own
// language (not the sender's).
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

export function isMemberAdmin(member, ownerId) {
  if (!member) return false;
  if (member.role === "admin") return true;
  if (member.role === "member") return false;
  // Fallback for legacy funds without role set on members
  const memberId = member.id || member.uid;
  return Boolean(ownerId && memberId && memberId === ownerId);
}

export function getMemberRole(member, ownerId) {
  return isMemberAdmin(member, ownerId) ? "admin" : "member";
}

// Applies the user's current nickname to their member entry in a group's
// data (in-memory) and persists it to the DB if it's out of date. Shared by
// every place that reads a group's member list, so a nickname change
// propagates consistently everywhere.
function syncMyNicknameInGroup(groupId, data, authStore) {
  const currentNickname =
    authStore.userProfile?.nickname || authStore.user?.displayName;
  const uid = authStore.user?.uid;
  if (
    uid &&
    currentNickname &&
    data.members?.[uid] &&
    (data.members[uid].displayName !== currentNickname ||
      data.members[uid].nickname !== currentNickname)
  ) {
    data.members[uid].displayName = currentNickname;
    data.members[uid].nickname = currentNickname;
    set(dbRef(db, `groups/${groupId}/members/${uid}`), {
      ...data.members[uid],
      displayName: currentNickname,
      nickname: currentNickname,
    }).catch((err) => console.warn("Failed to sync member nickname:", err));
  }
}

export const useGroupsStore = defineStore("groups", () => {
  const groups = ref([]); // funds the current user belongs to
  const currentGroup = ref(null);
  let unsubscribeIds = null;
  // Listener for the currently-open group (for change notifications)
  let unsubscribeCurrentGroup = null;
  // Per-group real-time listeners backing the dashboard's `groups` list, so
  // a rename/currency/icon change from any member shows up live instead of
  // only after the next full reload.
  const groupCardListeners = new Map(); // groupId -> unsubscribe fn
  const groupCardData = new Map(); // groupId -> latest { id, ...data }

  function stopGroupCardListeners() {
    for (const unsub of groupCardListeners.values()) unsub();
    groupCardListeners.clear();
    groupCardData.clear();
  }

  function rebuildGroupsList(ids) {
    groups.value = ids.map((id) => groupCardData.get(id)).filter(Boolean);
    const authStore = useAuthStore();
    if (authStore.user) {
      cacheSet(`myGroups:${authStore.user.uid}`, groups.value);
    }
  }

  // Keeps `groups` in sync with the full data of every fund the user belongs
  // to, in real time: one onValue listener per group's `groups/{id}`, kept
  // alive/torn down as the user's group membership list changes.
  function listenToMyGroups() {
    const authStore = useAuthStore();
    if (!authStore.user) return;
    if (unsubscribeIds) unsubscribeIds();
    stopGroupCardListeners();

    // Show the last-synced funds immediately (e.g. cold start with no
    // connection) rather than an empty dashboard until we reconnect.
    const myGroupsCacheKey = `myGroups:${authStore.user.uid}`;
    cacheGet(myGroupsCacheKey).then((cached) => {
      if (cached && groups.value.length === 0) {
        groups.value = cached;
      }
    });

    const idsRef = dbRef(db, `users/${authStore.user.uid}/groups`);
    unsubscribeIds = onValue(idsRef, (snapshot) => {
      const ids = snapshot.exists() ? Object.keys(snapshot.val()) : [];

      // Stop listening to funds we no longer belong to.
      for (const [id, unsub] of groupCardListeners.entries()) {
        if (!ids.includes(id)) {
          unsub();
          groupCardListeners.delete(id);
          groupCardData.delete(id);
        }
      }

      // Start listening to any newly-added funds.
      for (const id of ids) {
        if (groupCardListeners.has(id)) continue;
        const unsub = onValue(dbRef(db, `groups/${id}`), (groupSnap) => {
          if (!groupSnap.exists()) {
            groupCardData.delete(id);
            remove(dbRef(db, `users/${authStore.user.uid}/groups/${id}`)).catch(() => {});
          } else {
            const data = groupSnap.val();
            if (!data.members || !data.members[authStore.user.uid]) {
              groupCardData.delete(id);
              remove(dbRef(db, `users/${authStore.user.uid}/groups/${id}`)).catch(() => {});
            } else {
              syncMyNicknameInGroup(id, data, authStore);
              groupCardData.set(id, { id, ...data });
            }
          }
          rebuildGroupsList(ids);
        });
        groupCardListeners.set(id, unsub);
      }

      rebuildGroupsList(ids);
    });
  }

  function stopMyGroupsListener() {
    if (unsubscribeIds) {
      unsubscribeIds();
      unsubscribeIds = null;
    }
    stopGroupCardListeners();
  }

  function listenToGroup(groupId) {
    if (unsubscribeCurrentGroup) unsubscribeCurrentGroup();

    const cacheKey = `group:${groupId}`;
    // Fill the gap before Firebase's own listener fires (e.g. no
    // connection yet) with whatever we last saw for this fund. Real data
    // from onValue below always overwrites this once it arrives.
    cacheGet(cacheKey).then((cached) => {
      if (cached && !currentGroup.value) {
        currentGroup.value = { id: groupId, ...cached };
      }
    });

    const groupRef = dbRef(db, `groups/${groupId}`);
    unsubscribeCurrentGroup = onValue(groupRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        currentGroup.value = null;
        return;
      }
      currentGroup.value = { id: groupId, ...data };
      cacheSet(cacheKey, data);
    });
  }

  function stopGroupListener() {
    if (unsubscribeCurrentGroup) {
      unsubscribeCurrentGroup();
      unsubscribeCurrentGroup = null;
    }
  }


  async function createGroup(name, currency) {
    const authStore = useAuthStore();
    const user = authStore.user;
    const nickname =
      authStore.userProfile?.nickname || user.displayName || "User";
    const newGroupRef = push(dbRef(db, "groups"));
    const groupId = newGroupRef.key;

    await set(newGroupRef, {
      name,
      currency,
      mode: "kitty",
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      members: {
        [user.uid]: {
          displayName: nickname,
          nickname,
          photoURL: user.photoURL,
          role: "admin",
          joinedAt: serverTimestamp(),
        },
      },
    });
    await set(dbRef(db, `users/${user.uid}/groups/${groupId}`), true);
    return groupId;
  }

  // Anyone signed in with the invite link (the fund id) can add
  // themselves as a member — see database.rules.json.
  async function joinGroup(groupId) {
    const authStore = useAuthStore();
    const user = authStore.user;
    const nickname =
      authStore.userProfile?.nickname || user.displayName || "User";

    const groupSnap = await get(dbRef(db, `groups/${groupId}`));
    if (!groupSnap.exists()) {
      throw new Error("This fund does not exist.");
    }

    await set(dbRef(db, `groups/${groupId}/members/${user.uid}`), {
      displayName: nickname,
      nickname,
      photoURL: user.photoURL,
      role: "member",
      joinedAt: serverTimestamp(),
    });
    await set(dbRef(db, `users/${user.uid}/groups/${groupId}`), true);

    dispatchPushToGroupMembers(groupId, {
      titleKey: "notifications.memberJoined",
      titleParams: { name: nickname },
      data: { type: "memberJoined" },
    });
  }

  async function addPlaceholderMember(groupId, name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const newMemberRef = push(dbRef(db, `groups/${groupId}/members`));
    const memberId = newMemberRef.key;
    await set(newMemberRef, {
      displayName: trimmed,
      nickname: trimmed,
      photoURL: null,
      isPlaceholder: true,
      role: "member",
      createdAt: serverTimestamp(),
    });
    return memberId;
  }

  async function claimMember(groupId, placeholderMemberId) {
    const authStore = useAuthStore();
    const user = authStore.user;
    if (!user) throw new Error("Authentication required");

    const groupSnap = await get(dbRef(db, `groups/${groupId}`));
    if (!groupSnap.exists()) {
      throw new Error("This fund does not exist.");
    }
    const groupData = groupSnap.val();
    const placeholderMember = groupData.members?.[placeholderMemberId];
    if (!placeholderMember) {
      throw new Error("Placeholder member does not exist.");
    }

    const nickname =
      authStore.userProfile?.nickname ||
      user.displayName ||
      placeholderMember.nickname ||
      placeholderMember.displayName ||
      "User";

    // 1. Add current user as a full member
    const memberData = {
      displayName: nickname,
      nickname,
      photoURL: user.photoURL || null,
      role: placeholderMember.role || (groupData.ownerId === placeholderMemberId ? "admin" : "member"),
      joinedAt: serverTimestamp(),
      claimedAt: serverTimestamp(),
      claimedFrom: placeholderMemberId,
    };
    if (placeholderMember.color) {
      memberData.color = placeholderMember.color;
    }

    await set(dbRef(db, `groups/${groupId}/members/${user.uid}`), memberData);
    await set(dbRef(db, `users/${user.uid}/groups/${groupId}`), true);

    // 2. Migrate transactions referencing placeholderMemberId
    try {
      const txSnap = await get(dbRef(db, `transactions/${groupId}`));
      if (txSnap.exists()) {
        const allTx = txSnap.val();
        const updates = {};
        for (const [txId, tx] of Object.entries(allTx)) {
          let changed = false;
          const txUpdate = {};

          if (tx.paidBy === placeholderMemberId) {
            txUpdate[`${txId}/paidBy`] = user.uid;
            changed = true;
          }
          if (tx.to === placeholderMemberId) {
            txUpdate[`${txId}/to`] = user.uid;
            changed = true;
          }
          if (Array.isArray(tx.splitAmong) && tx.splitAmong.includes(placeholderMemberId)) {
            txUpdate[`${txId}/splitAmong`] = tx.splitAmong.map((id) =>
              id === placeholderMemberId ? user.uid : id,
            );
            changed = true;
          }
          if (tx.splitShares && tx.splitShares[placeholderMemberId] !== undefined) {
            const newShares = { ...tx.splitShares };
            newShares[user.uid] = newShares[placeholderMemberId];
            delete newShares[placeholderMemberId];
            txUpdate[`${txId}/splitShares`] = newShares;
            changed = true;
          }

          if (changed) {
            Object.assign(updates, txUpdate);
          }
        }

        if (Object.keys(updates).length > 0) {
          await update(dbRef(db, `transactions/${groupId}`), updates);
        }
      }
    } catch (err) {
      console.error("Error migrating transactions on claim:", err);
    }

    // 3. If placeholder member was group owner, transfer ownership to new user
    if (groupData.ownerId === placeholderMemberId) {
      await set(dbRef(db, `groups/${groupId}/ownerId`), user.uid);
    }

    // 4. Remove the placeholder member from group.members
    await remove(dbRef(db, `groups/${groupId}/members/${placeholderMemberId}`));

    // 5. Notify members
    dispatchPushToGroupMembers(groupId, {
      titleKey: "notifications.memberJoined",
      titleParams: { name: nickname },
      data: { type: "memberJoined" },
    });
  }

  async function loadGroup(groupId) {
    const cacheKey = `group:${groupId}`;
    try {
      // Race against a timeout rather than awaiting `get()` indefinitely —
      // offline with nothing cached server-side, this could otherwise hang
      // until a connection appears instead of falling back below.
      const snap = await withTimeout(get(dbRef(db, `groups/${groupId}`)));
      if (snap.exists()) {
        const data = snap.val();
        const authStore = useAuthStore();
        syncMyNicknameInGroup(groupId, data, authStore);
        currentGroup.value = { id: groupId, ...data };
        cacheSet(cacheKey, data);
      } else {
        currentGroup.value = null;
      }
    } catch (err) {
      // Likely offline — fall back to the last-synced copy of this fund
      // instead of leaving the page with nothing (or bouncing the user back
      // to the dashboard, since callers treat a null currentGroup as "this
      // fund doesn't exist").
      const cached = await cacheGet(cacheKey);
      if (cached) {
        console.warn("Could not load fund, using last-synced copy:", err);
        currentGroup.value = { id: groupId, ...cached };
      } else {
        throw err;
      }
    }
    return currentGroup.value;
  }

  async function updateCurrency(groupId, newCurrency) {
    await set(dbRef(db, `groups/${groupId}/currency`), newCurrency);
  }

  async function updateName(groupId, newName) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await set(dbRef(db, `groups/${groupId}/name`), trimmed);
    dispatchPushToGroupMembers(groupId, {
      titleKey: "notifications.groupRenamed",
      titleParams: { name: trimmed },
      data: { type: "groupRenamed" },
    });
  }

  // mode: 'kitty' (shared pool funded by deposits) or 'split' (members
  // settle expenses directly with each other, no deposits).
  async function updateMode(groupId, newMode) {
    await set(dbRef(db, `groups/${groupId}/mode`), newMode);
  }

  async function updateMemberRole(groupId, memberId, newRole) {
    if (newRole !== "admin" && newRole !== "member") {
      throw new Error("Invalid role specified.");
    }

    const groupSnap = await get(dbRef(db, `groups/${groupId}`));
    if (!groupSnap.exists()) {
      throw new Error("Group does not exist.");
    }
    const group = groupSnap.val();
    const members = group.members || {};
    const targetMember = members[memberId];
    if (!targetMember) {
      throw new Error("Member not found in group.");
    }

    const currentRole = getMemberRole({ id: memberId, ...targetMember }, group.ownerId);

    // If demoting from admin to member, check if they are the last admin
    if (currentRole === "admin" && newRole === "member") {
      const adminCount = Object.entries(members).filter(([id, m]) =>
        isMemberAdmin({ id, ...m }, group.ownerId)
      ).length;

      if (adminCount <= 1) {
        throw new Error("Cannot demote the last remaining admin.");
      }
    }

    await set(dbRef(db, `groups/${groupId}/members/${memberId}/role`), newRole);
  }

  async function removeMember(groupId, userId) {
    const groupSnap = await get(
      dbRef(db, `groups/${groupId}`),
    );
    if (!groupSnap.exists()) return;
    const group = groupSnap.val();
    const members = group.members || {};
    const memberData = members[userId];
    const memberName = memberData?.nickname || memberData?.displayName;

    // If removing an admin, ensure they are not the only admin when multiple members exist
    const memberCount = Object.keys(members).length;
    if (memberCount > 1 && isMemberAdmin({ id: userId, ...memberData }, group.ownerId)) {
      const adminCount = Object.entries(members).filter(([id, m]) =>
        isMemberAdmin({ id, ...m }, group.ownerId)
      ).length;

      if (adminCount <= 1) {
        throw new Error("Cannot remove the last remaining admin.");
      }
    }

    await remove(dbRef(db, `groups/${groupId}/members/${userId}`));
    try {
      await remove(dbRef(db, `users/${userId}/groups/${groupId}`));
    } catch {
      // Security rules may prevent deleting from another user's index;
      // their client cleans it up automatically when they next sync.
    }

    dispatchPushToGroupMembers(groupId, {
      titleKey: "notifications.memberLeft",
      titleParams: { name: memberName },
      data: { type: "memberLeft" },
    });
  }

  async function leaveGroup(groupId) {
    const authStore = useAuthStore();
    const myUid = authStore.user?.uid;
    if (!myUid) return;
    await removeMember(groupId, myUid);
  }

  async function deleteGroup(groupId) {
    const authStore = useAuthStore();
    const myUid = authStore.user?.uid;

    await remove(dbRef(db, `groups/${groupId}`));
    await remove(dbRef(db, `transactions/${groupId}`)).catch(() => {});
    await remove(dbRef(db, `scanLimits/${groupId}`)).catch(() => {});
    await remove(dbRef(db, `categoryOverrides/${groupId}`)).catch(() => {});
    if (myUid) {
      await remove(dbRef(db, `users/${myUid}/groups/${groupId}`)).catch(() => {});
    }
  }

  async function transferOwnership(groupId, newOwnerId) {
    await set(dbRef(db, `groups/${groupId}/ownerId`), newOwnerId);
  }

  async function addCategory(groupId, category, icon = null) {
    const newCategoryRef = push(dbRef(db, `groups/${groupId}/categories`));
    await set(newCategoryRef, {
      name: category,
      icon: icon || null,
      createdAt: serverTimestamp(),
    });
  }

  async function removeCategory(groupId, categoryId) {
    await remove(dbRef(db, `groups/${groupId}/categories/${categoryId}`));
  }

  // Budgets are keyed by category name (not id) so a limit can be set on
  // built-in categories (Food & Groceries, Transport, ...) as well as
  // custom ones, none of which need to already exist in `categories`.
  async function setCategoryBudget(groupId, categoryName, amount, icon = null) {
    const key = categoryBudgetKey(categoryName);
    await set(dbRef(db, `groups/${groupId}/categoryBudgets/${key}`), {
      name: categoryName,
      amount: Number(amount),
      icon: icon || null,
      updatedAt: serverTimestamp(),
    });
  }

  async function removeCategoryBudget(groupId, categoryName) {
    const key = categoryBudgetKey(categoryName);
    await remove(dbRef(db, `groups/${groupId}/categoryBudgets/${key}`));
  }

  // The fund's "central" icon — shared by everyone, meant to be set by the
  // owner only (enforced in the UI, same convention as currency/mode/categories).
  async function setGroupIcon(groupId, icon) {
    await set(dbRef(db, `groups/${groupId}/icon`), icon);
    dispatchPushToGroupMembers(groupId, {
      titleKey: "notifications.groupIconChanged",
      data: { type: "groupIconChanged" },
    });
  }

  // Personal per-fund color — each member sets their own, stored on their
  // own member entry so it never affects what other members see.
  async function setMyColor(groupId, color) {
    const authStore = useAuthStore();
    if (!authStore.user) return;
    await set(
      dbRef(db, `groups/${groupId}/members/${authStore.user.uid}/color`),
      color,
    );
  }

  // Creates a new fund populated with imported data, sets up placeholder profiles, and imports transactions in batch
  async function createGroupWithImportedData({
    name,
    currency,
    mode = "split",
    sourceMembers = [],
    currentUserSourceName = null,
    transactions = [],
    customCategories = [],
    onProgress = null,
  }) {
    const authStore = useAuthStore();
    const user = authStore.user;
    if (!user) throw new Error("Authentication required");

    const nickname =
      authStore.userProfile?.nickname || user.displayName || "User";
    const newGroupRef = push(dbRef(db, "groups"));
    const groupId = newGroupRef.key;

    // 1. Build members list
    const groupMembers = {
      [user.uid]: {
        displayName: nickname,
        nickname,
        photoURL: user.photoURL || null,
        role: "admin",
        joinedAt: serverTimestamp(),
      },
    };

    const memberMap = {};
    if (currentUserSourceName) {
      memberMap[currentUserSourceName] = user.uid;
    }

    for (const memberName of sourceMembers) {
      const trimmed = String(memberName).trim();
      if (!trimmed) continue;
      if (memberName === currentUserSourceName || memberMap[trimmed]) continue;

      // Check if matches current user nickname/displayName
      if (
        !currentUserSourceName &&
        trimmed.toLowerCase() === nickname.toLowerCase()
      ) {
        memberMap[trimmed] = user.uid;
        continue;
      }

      // Create placeholder member
      const placeholderRef = push(dbRef(db, `groups/${groupId}/members`));
      const placeholderId = placeholderRef.key;
      groupMembers[placeholderId] = {
        displayName: trimmed,
        nickname: trimmed,
        photoURL: null,
        isPlaceholder: true,
        role: "member",
        createdAt: serverTimestamp(),
      };
      memberMap[trimmed] = placeholderId;
    }

    // Default fallback: if any member not yet in map, map to current user
    for (const memberName of sourceMembers) {
      if (!memberMap[memberName]) {
        memberMap[memberName] = user.uid;
      }
    }

    const groupData = {
      name: name.trim() || "Imported Fund",
      currency: currency || "USD",
      mode: mode || "split",
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      members: groupMembers,
    };

    if (Array.isArray(customCategories) && customCategories.length > 0) {
      const catObj = {};
      for (const cat of customCategories) {
        const catName = typeof cat === "string" ? cat : cat.name;
        const catIcon = typeof cat === "object" ? cat.icon : null;
        if (catName) {
          const catRef = push(dbRef(db, `groups/${groupId}/categories`));
          catObj[catRef.key] = {
            name: catName,
            icon: catIcon || null,
            createdAt: serverTimestamp(),
          };
        }
      }
      if (Object.keys(catObj).length > 0) {
        groupData.categories = catObj;
      }
    }

    await set(newGroupRef, groupData);
    await set(dbRef(db, `users/${user.uid}/groups/${groupId}`), true);

    // 2. Import transactions in bulk
    const txStore = useTransactionsStore();
    if (transactions.length > 0) {
      await txStore.importTransactionsBatch(
        groupId,
        groupData.currency,
        transactions,
        memberMap,
        { onProgress },
      );
    }

    return groupId;
  }

  return {
    groups,
    currentGroup,
    listenToMyGroups,
    stopMyGroupsListener,
    listenToGroup,
    stopGroupListener,
    createGroup,
    createGroupWithImportedData,
    joinGroup,
    addPlaceholderMember,
    claimMember,
    loadGroup,
    updateCurrency,
    updateName,
    updateMode,
    updateMemberRole,
    removeMember,
    leaveGroup,
    deleteGroup,
    transferOwnership,
    addCategory,
    removeCategory,
    setCategoryBudget,
    removeCategoryBudget,
    setGroupIcon,
    setMyColor,
  };
});
