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

export const useGroupsStore = defineStore("groups", () => {
  const groups = ref([]); // funds the current user belongs to
  const currentGroup = ref(null);
  let unsubscribeIds = null;

  // Listens to users/{uid}/groups (an index of fund ids) and keeps
  // `groups` in sync with the full fund data for each one.
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
          return groupSnap.exists() ? { id, ...groupSnap.val() } : null;
        }),
      );
      groups.value = loaded.filter(Boolean);
    });
  }

  async function createGroup(name, currency) {
    const authStore = useAuthStore();
    const user = authStore.user;
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
          displayName: user.displayName,
          photoURL: user.photoURL,
          joinedAt: serverTimestamp(),
        },
      },
    });
    await set(dbRef(db, `users/${user.uid}/groups/${groupId}`), true);
    return groupId;
  }

  // Anyone signed in who has the invite link (i.e. knows the fund id)
  // can add themselves as a member. See database.rules.json: a member
  // can only ever write their own membership entry, never anyone else's.
  async function joinGroup(groupId) {
    const authStore = useAuthStore();
    const user = authStore.user;

    const groupSnap = await get(dbRef(db, `groups/${groupId}`));
    if (!groupSnap.exists()) {
      throw new Error("This fund does not exist.");
    }

    await set(dbRef(db, `groups/${groupId}/members/${user.uid}`), {
      displayName: user.displayName,
      photoURL: user.photoURL,
      joinedAt: serverTimestamp(),
    });
    await set(dbRef(db, `users/${user.uid}/groups/${groupId}`), true);
  }

  async function loadGroup(groupId) {
    const snap = await get(dbRef(db, `groups/${groupId}`));
    currentGroup.value = snap.exists() ? { id: groupId, ...snap.val() } : null;
    return currentGroup.value;
  }

  async function updateCurrency(groupId, newCurrency) {
    await set(dbRef(db, `groups/${groupId}/currency`), newCurrency);
  }

  // mode: 'kitty' (default, shared pool funded by deposits) or
  // 'split' (no deposits — every expense is split between members and
  // members settle their share directly with each other).
  async function updateMode(groupId, newMode) {
    await set(dbRef(db, `groups/${groupId}/mode`), newMode);
  }

  async function removeMember(groupId, userId) {
    await remove(dbRef(db, `groups/${groupId}/members/${userId}`));
    await remove(dbRef(db, `users/${userId}/groups/${groupId}`));
  }

  async function addCategory(groupId, category) {
    const newCategoryRef = push(dbRef(db, `groups/${groupId}/categories`));
    await set(newCategoryRef, {
      name: category,
      createdAt: serverTimestamp(),
    });
  }

  async function removeCategory(groupId, categoryId) {
    await remove(dbRef(db, `groups/${groupId}/categories/${categoryId}`));
  }

  return {
    groups,
    currentGroup,
    listenToMyGroups,
    createGroup,
    joinGroup,
    loadGroup,
    updateCurrency,
    updateMode,
    removeMember,
    addCategory,
    removeCategory,
  };
});
