import { defineStore } from "pinia";
import { ref } from "vue";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { ref as dbRef, get, set, serverTimestamp } from "firebase/database";
import { auth, db, googleProvider } from "@/firebase/config";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(null);
  const userProfile = ref(null);
  const isReady = ref(false);

  // Resolves once the initial auth state is known, so the router
  // never has to guess whether someone is logged in.
  function init() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        user.value = firebaseUser;
        if (firebaseUser) {
          await ensureUserProfile(firebaseUser);
          await loadUserProfile(firebaseUser);
        }
        isReady.value = true;
        resolve();
      });
    });
  }

  async function ensureUserProfile(firebaseUser) {
    const profileRef = dbRef(db, `users/${firebaseUser.uid}`);
    const snapshot = await get(profileRef);
    if (!snapshot.exists()) {
      await set(profileRef, {
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
        nickname: firebaseUser.displayName,
        createdAt: serverTimestamp(),
      });
    }
  }

  async function loadUserProfile(firebaseUser) {
    const profileRef = dbRef(db, `users/${firebaseUser.uid}`);
    const snapshot = await get(profileRef);
    if (snapshot.exists()) {
      userProfile.value = snapshot.val();
    }
  }

  async function updateNickname(newNickname) {
    if (!user.value) return;
    const profileRef = dbRef(db, `users/${user.value.uid}`);
    await set(profileRef, {
      ...userProfile.value,
      nickname: newNickname,
    });
    userProfile.value = { ...userProfile.value, nickname: newNickname };
  }

  async function loginWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function logout() {
    await firebaseSignOut(auth);
  }

  return {
    user,
    userProfile,
    isReady,
    init,
    loginWithGoogle,
    logout,
    updateNickname,
  };
});
