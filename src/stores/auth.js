import { defineStore } from "pinia";
import { ref } from "vue";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { ref as dbRef, get, set, serverTimestamp } from "firebase/database";
import { auth, db, googleProvider } from "@/services/firebase/config";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(null);
  const userProfile = ref(null);
  const isReady = ref(false);
  const authError = ref(null);

  // Ensure persistent session storage across tab reloads / mobile browser switches
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Could not set auth persistence:", err);
  });

  // Resolves once the initial auth state is known, so the router
  // never has to guess whether someone is logged in.
  function init() {
    return new Promise(async (resolve) => {
      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user) {
          user.value = redirectResult.user;
          await ensureUserProfile(redirectResult.user);
          await loadUserProfile(redirectResult.user);
        }
      } catch (error) {
        console.error("Error processing redirect login:", error);
        authError.value = error.message || String(error);
      }

      let isInitial = true;
      onAuthStateChanged(auth, async (firebaseUser) => {
        user.value = firebaseUser;
        if (firebaseUser) {
          await ensureUserProfile(firebaseUser);
          await loadUserProfile(firebaseUser);
        } else {
          userProfile.value = null;
        }
        isReady.value = true;
        if (isInitial) {
          isInitial = false;
          resolve();
        }
      });
    });
  }

  async function ensureUserProfile(firebaseUser) {
    if (!firebaseUser) return;
    const profileRef = dbRef(db, `users/${firebaseUser.uid}`);
    const snapshot = await get(profileRef);
    if (!snapshot.exists()) {
      await set(profileRef, {
        displayName: firebaseUser.displayName || "User",
        email: firebaseUser.email || "",
        photoURL: firebaseUser.photoURL || "",
        nickname: firebaseUser.displayName || "User",
        createdAt: serverTimestamp(),
      });
    }
  }

  async function loadUserProfile(firebaseUser) {
    if (!firebaseUser) return;
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

    try {
      const groupsSnap = await get(dbRef(db, `users/${user.value.uid}/groups`));
      if (groupsSnap.exists()) {
        const groupIds = Object.keys(groupsSnap.val());
        await Promise.all(
          groupIds.map(async (groupId) => {
            const memberRef = dbRef(
              db,
              `groups/${groupId}/members/${user.value.uid}`,
            );
            const memberSnap = await get(memberRef);
            if (memberSnap.exists()) {
              await set(memberRef, {
                ...memberSnap.val(),
                displayName: newNickname,
                nickname: newNickname,
              });
            }
          }),
        );
      }
    } catch (err) {
      console.warn("Could not update nickname in groups:", err);
    }
  }

  // After native sign-in resolves, the Firebase Web SDK's `auth.currentUser`
  // (and its ID token, which the Realtime Database rules check) sync in
  // asynchronously — they are not guaranteed to be ready yet when
  // signInWithGoogle() returns. Writing to the database before that sync
  // completes fails with a rules "Permission denied" error even though sign-in
  // itself succeeded. This waits for the real, usable Web SDK session.
  function waitForSyncedUser(timeoutMs = 8000) {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          unsubscribe();
          clearTimeout(timer);
          resolve(firebaseUser);
        }
      });
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error("Timed out waiting for the Firebase session to sync after native sign-in."));
      }, timeoutMs);
    });
  }

  async function loginWithGoogle() {
    authError.value = null;

    // Google actively blocks OAuth sign-in inside embedded/WebView user agents
    // (the Android app's WebView included), so signInWithPopup/signInWithRedirect
    // from the Firebase Web SDK can never succeed there. On native platforms we
    // go through the device's native Google Sign-In instead; the plugin then
    // feeds the resulting credential into this same Firebase Web SDK `auth`
    // instance, so onAuthStateChanged below still fires normally.
    if (Capacitor.isNativePlatform()) {
      try {
        await FirebaseAuthentication.signInWithGoogle();
        const firebaseUser = await waitForSyncedUser();
        user.value = firebaseUser;
        await ensureUserProfile(firebaseUser);
        await loadUserProfile(firebaseUser);
      } catch (error) {
        console.warn("Native Google sign-in failed:", error?.code, error?.message);
        authError.value = error.message || String(error);
        throw error;
      }
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result?.user) {
        user.value = result.user;
        await ensureUserProfile(result.user);
        await loadUserProfile(result.user);
      }
    } catch (error) {
      console.warn("signInWithPopup failed:", error?.code, error?.message);
      if (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request" ||
        error.code === "auth/operation-not-allowed"
      ) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        authError.value = error.message || String(error);
        throw error;
      }
    }
  }

  async function logout() {
    await firebaseSignOut(auth);
    user.value = null;
    userProfile.value = null;
  }

  return {
    user,
    userProfile,
    isReady,
    authError,
    init,
    loginWithGoogle,
    logout,
    updateNickname,
  };
});
