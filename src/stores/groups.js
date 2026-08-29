import { defineStore } from "pinia";
import { ref } from "vue";
import {
  ref as dbRef,
  push,
  set,
  get,
  onValue,
  serverTimestamp,
  remove,
} from "firebase/database";
import { db } from "@/services/firebase/config";
import { useAuthStore } from "./auth";
import { sendPushNotificationToUsers } from "@/services/notificationService";

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
  }

  // Keeps `groups` in sync with the full data of every fund the user belongs
  // to, in real time: one onValue listener per group's `groups/{id}`, kept
  // alive/torn down as the user's group membership list changes.
  function listenToMyGroups() {
    const authStore = useAuthStore();
    if (!authStore.user) return;
    if (unsubscribeIds) unsubscribeIds();
    stopGroupCardListeners();

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

    const groupRef = dbRef(db, `groups/${groupId}`);
    unsubscribeCurrentGroup = onValue(groupRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        currentGroup.value = null;
        return;
      }
      currentGroup.value = { id: groupId, ...data };
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
      joinedAt: serverTimestamp(),
    });
    await set(dbRef(db, `users/${user.uid}/groups/${groupId}`), true);

    dispatchPushToGroupMembers(groupId, {
      titleKey: "notifications.memberJoined",
      titleParams: { name: nickname },
      data: { type: "memberJoined" },
    });
  }

  async function loadGroup(groupId) {
    const snap = await get(dbRef(db, `groups/${groupId}`));
    if (snap.exists()) {
      const data = snap.val();
      const authStore = useAuthStore();
      syncMyNicknameInGroup(groupId, data, authStore);
      currentGroup.value = { id: groupId, ...data };
    } else {
      currentGroup.value = null;
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

  async function removeMember(groupId, userId) {
    const groupSnap = await get(
      dbRef(db, `groups/${groupId}/members/${userId}`),
    );
    const memberName = groupSnap.exists()
      ? groupSnap.val()?.nickname || groupSnap.val()?.displayName
      : undefined;

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

  return {
    groups,
    currentGroup,
    listenToMyGroups,
    stopMyGroupsListener,
    listenToGroup,
    stopGroupListener,
    createGroup,
    joinGroup,
    loadGroup,
    updateCurrency,
    updateName,
    updateMode,
    removeMember,
    leaveGroup,
    deleteGroup,
    transferOwnership,
    addCategory,
    removeCategory,
    setGroupIcon,
    setMyColor,
  };
});
