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
import i18next from "@/i18n";

async function dispatchPushToGroupMembers(groupId, title, body, data = {}) {
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
      title,
      body,
      data: { groupId, ...data },
    });
  } catch (err) {
    console.warn("Could not dispatch push to group members:", err);
  }
}

export const useGroupsStore = defineStore("groups", () => {
  const groups = ref([]); // funds the current user belongs to
  const currentGroup = ref(null);
  let unsubscribeIds = null;
  // Listener for the currently-open group (for change notifications)
  let unsubscribeCurrentGroup = null;

  // Keeps `groups` in sync with the full data of every fund the user belongs to.
  function listenToMyGroups() {
    const authStore = useAuthStore();
    if (!authStore.user) return;
    if (unsubscribeIds) unsubscribeIds();

    const idsRef = dbRef(db, `users/${authStore.user.uid}/groups`);
    unsubscribeIds = onValue(idsRef, async (snapshot) => {
      const ids = snapshot.exists() ? Object.keys(snapshot.val()) : [];
      const loaded = await Promise.all(
        ids.map(async (id) => {
          const groupSnap = await get(dbRef(db, `groups/${id}`));
          if (!groupSnap.exists()) return null;
          const data = groupSnap.val();
          const currentNickname =
            authStore.userProfile?.nickname || authStore.user?.displayName;
          if (
            currentNickname &&
            data.members?.[authStore.user.uid] &&
            (data.members[authStore.user.uid].displayName !== currentNickname ||
              data.members[authStore.user.uid].nickname !== currentNickname)
          ) {
            data.members[authStore.user.uid].displayName = currentNickname;
            data.members[authStore.user.uid].nickname = currentNickname;
            set(dbRef(db, `groups/${id}/members/${authStore.user.uid}`), {
              ...data.members[authStore.user.uid],
              displayName: currentNickname,
              nickname: currentNickname,
            }).catch(() => {});
          }
          return { id, ...data };
        }),
      );
      groups.value = loaded.filter(Boolean);
    });
  }

  function listenToGroup(groupId) {
    if (unsubscribeCurrentGroup) unsubscribeCurrentGroup();

    const groupRef = dbRef(db, `groups/${groupId}`);
    unsubscribeCurrentGroup = onValue(groupRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
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

    dispatchPushToGroupMembers(
      groupId,
      i18next.t("notifications.memberJoined", { name: nickname }),
      "",
      { type: "memberJoined" },
    );
  }

  async function loadGroup(groupId) {
    const snap = await get(dbRef(db, `groups/${groupId}`));
    if (snap.exists()) {
      const data = snap.val();
      const authStore = useAuthStore();
      const currentNickname =
        authStore.userProfile?.nickname || authStore.user?.displayName;
      if (
        authStore.user &&
        currentNickname &&
        data.members?.[authStore.user.uid] &&
        (data.members[authStore.user.uid].displayName !== currentNickname ||
          data.members[authStore.user.uid].nickname !== currentNickname)
      ) {
        data.members[authStore.user.uid].displayName = currentNickname;
        data.members[authStore.user.uid].nickname = currentNickname;
        set(dbRef(db, `groups/${groupId}/members/${authStore.user.uid}`), {
          ...data.members[authStore.user.uid],
          displayName: currentNickname,
          nickname: currentNickname,
        }).catch((err) => console.warn("Failed to sync member nickname:", err));
      }
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
    dispatchPushToGroupMembers(
      groupId,
      i18next.t("notifications.groupRenamed", { name: trimmed }),
      "",
      { type: "groupRenamed" },
    );
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
      ? groupSnap.val()?.nickname ||
        groupSnap.val()?.displayName ||
        i18next.t("common.someone")
      : i18next.t("common.someone");

    await remove(dbRef(db, `groups/${groupId}/members/${userId}`));
    await remove(dbRef(db, `users/${userId}/groups/${groupId}`));

    dispatchPushToGroupMembers(
      groupId,
      i18next.t("notifications.memberLeft", { name: memberName }),
      "",
      { type: "memberLeft" },
    );
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
    dispatchPushToGroupMembers(
      groupId,
      i18next.t("notifications.groupIconChanged"),
      "",
      { type: "groupIconChanged" },
    );
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
    listenToGroup,
    stopGroupListener,
    createGroup,
    joinGroup,
    loadGroup,
    updateCurrency,
    updateName,
    updateMode,
    removeMember,
    addCategory,
    removeCategory,
    setGroupIcon,
    setMyColor,
  };
});
