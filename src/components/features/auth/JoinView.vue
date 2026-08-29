<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useGroupsStore } from "@/stores/groups";
import { useAuthStore } from "@/stores/auth";
import { useTranslation } from "i18next-vue";
import { Capacitor } from "@capacitor/core";
import { ref as dbRef, get } from "firebase/database";
import { db } from "@/services/firebase/config";
import LanguageSelector from "@/components/common/LanguageSelector.vue";

const route = useRoute();
const router = useRouter();
const groupsStore = useGroupsStore();
const authStore = useAuthStore();
const { t } = useTranslation();

const loading = ref(false);
const signingIn = ref(false);
const fetchingGroup = ref(true);
const error = ref("");

const groupData = ref(null);
const joinChoice = ref("new"); // 'new' | 'claim'
const selectedClaimMemberId = ref("");

// Show the "Open in App" overlay whenever visiting on the web
const showOpenInApp = ref(!Capacitor.isNativePlatform());
const showDeepLinkFallback = ref(false);

const groupId = computed(() => route.params.id);

const isAlreadyMember = computed(() => {
  if (!authStore.user || !groupData.value?.members) return false;
  return !!groupData.value.members[authStore.user.uid];
});

const unclaimedMembers = computed(() => {
  if (!groupData.value?.members) return [];
  return Object.entries(groupData.value.members)
    .filter(([id, m]) => m.isPlaceholder)
    .map(([id, m]) => ({
      id,
      ...m,
      displayName: m.nickname || m.displayName || "Someone",
    }));
});

function openInApp() {
  window.location.href = `kasseo://join/${groupId.value}`;
  setTimeout(() => {
    showDeepLinkFallback.value = true;
  }, 750);
}

function continueInBrowser() {
  showOpenInApp.value = false;
}

async function loadGroupData() {
  if (!groupId.value) return;
  fetchingGroup.value = true;
  try {
    const snap = await get(dbRef(db, `groups/${groupId.value}`));
    if (snap.exists()) {
      groupData.value = snap.val();
      if (unclaimedMembers.value.length > 0) {
        selectedClaimMemberId.value = unclaimedMembers.value[0].id;
      }
    } else {
      error.value = t("join.invalidLink");
    }
  } catch (e) {
    console.error("Failed to load group for join:", e);
    error.value = t("join.invalidLink");
  } finally {
    fetchingGroup.value = false;
  }
}

// ── Sign-in ──────────────────────────────────────────────────────────────────

async function handleSignIn() {
  signingIn.value = true;
  error.value = "";
  try {
    await authStore.loginWithGoogle();
  } catch (e) {
    console.error("Sign-in error:", e);
    error.value = t("login.errorDefault");
  } finally {
    signingIn.value = false;
  }
}

// When user is authenticated or changes, check membership
watch(
  () => authStore.user,
  async (newUser) => {
    if (newUser && !fetchingGroup.value) {
      if (isAlreadyMember.value) {
        router.push({ name: "group", params: { id: groupId.value } });
        return;
      }
      // If native and NO unclaimed members, auto join
      if (Capacitor.isNativePlatform() && unclaimedMembers.value.length === 0 && !loading.value) {
        await handleJoin();
      }
    }
  },
);

// ── Join / Claim ─────────────────────────────────────────────────────────────

async function handleJoin() {
  if (!authStore.user) {
    error.value = t("join.signInRequired");
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    if (joinChoice.value === "claim" && selectedClaimMemberId.value) {
      await groupsStore.claimMember(groupId.value, selectedClaimMemberId.value);
    } else {
      await groupsStore.joinGroup(groupId.value);
    }
    router.push({ name: "group", params: { id: groupId.value } });
  } catch (e) {
    console.error("Join/Claim error:", e);
    error.value = t("join.invalidLink");
  } finally {
    loading.value = false;
  }
}

function goToGroup() {
  router.push({ name: "group", params: { id: groupId.value } });
}

// ── Mount ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  await loadGroupData();
  if (authStore.user) {
    if (isAlreadyMember.value) {
      router.push({ name: "group", params: { id: groupId.value } });
      return;
    }
    if (Capacitor.isNativePlatform() && unclaimedMembers.value.length === 0) {
      handleJoin();
    }
  }
});
</script>

<template>
  <div class="flex items-center justify-center relative py-12 px-4" style="min-height: 80vh">
    <div class="absolute top-4 right-4 z-10">
      <LanguageSelector variant="dropdown" />
    </div>

    <!-- ── "Open in App" overlay ─────────────────────────────────────────── -->
    <Transition name="fade">
      <div
        v-if="showOpenInApp"
        class="absolute inset-0 z-20 flex items-center justify-center bg-background/80 dark:bg-background-dark/80 backdrop-blur-sm px-4"
      >
        <div
          class="bg-white dark:bg-surface-dark rounded-2xl p-8 text-center shadow-xl max-w-[360px] w-full"
        >
          <div
            class="w-16 h-16 bg-[#C8A5FC] rounded-2xl flex items-center justify-center mx-auto mb-4"
          >
            <i class="fas fa-layer-group text-white text-2xl"></i>
          </div>

          <h2 class="text-xl font-bold font-display dark:text-white mb-2">
            {{ $t("join.openInAppTitle") }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {{ $t("join.openInAppPrompt") }}
          </p>

          <p
            v-if="showDeepLinkFallback"
            class="text-xs text-amber-500 dark:text-amber-400 mb-4"
          >
            {{ $t("join.deepLinkFallback") }}
          </p>

          <button
            @click="openInApp"
            class="w-full px-4 py-3 bg-[#C8A5FC] text-white font-semibold rounded-xl hover:bg-[#A78BCA] transition-colors mb-3"
          >
            <i class="fas fa-mobile-alt mr-2"></i>
            {{ $t("join.openInApp") }}
          </button>

          <button
            @click="continueInBrowser"
            class="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors py-1"
          >
            {{ $t("join.continueInBrowser") }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── Join card ─────────────────────────────────────────────────────── -->
    <div
      class="bg-white dark:bg-surface-dark rounded-2xl p-6 sm:p-8 text-center shadow-xl max-w-[440px] w-full"
      :class="{ 'opacity-30 pointer-events-none select-none': showOpenInApp }"
    >
      <!-- Loading indicator while loading group -->
      <div v-if="fetchingGroup" class="py-12">
        <i class="fas fa-spinner fa-spin text-3xl text-[#C8A5FC] mb-3"></i>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('common.loading') }}</p>
      </div>

      <template v-else>
        <div
          class="w-14 h-14 bg-[#C8A5FC] rounded-full flex items-center justify-center mx-auto mb-3"
        >
          <i class="fas fa-user-plus text-white text-xl"></i>
        </div>

        <h1 class="text-xl font-bold mb-1 font-display dark:text-white">
          {{ groupData?.name || $t("join.title") }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {{ $t("join.subtitle") }}
        </p>

        <div
          v-if="error"
          class="bg-[#C1503A]/10 border border-[#C1503A] text-[#C1503A] rounded-xl p-3 mb-5 text-sm text-left"
        >
          {{ error }}
        </div>

        <!-- ── Already member state ──────────────────────────────────────── -->
        <div v-if="isAlreadyMember" class="space-y-4">
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm">
            <i class="fas fa-check-circle mr-1.5"></i>
            {{ $t("join.alreadyMember") }}
          </div>
          <button
            @click="goToGroup"
            class="w-full px-4 py-3 bg-[#C8A5FC] text-white font-semibold rounded-xl hover:bg-[#A78BCA] transition-colors"
          >
            {{ $t("join.goToFund") }}
          </button>
        </div>

        <!-- ── Authenticated User Flow ───────────────────────────────────── -->
        <div v-else-if="authStore.user" class="space-y-4 text-left">
          <!-- Selection when unclaimed placeholder members exist -->
          <div v-if="unclaimedMembers.length > 0" class="space-y-3">
            <!-- Option 1: Join as new member -->
            <label
              class="block p-3.5 rounded-xl border-2 cursor-pointer transition-all"
              :class="
                joinChoice === 'new'
                  ? 'border-[#C8A5FC] bg-[#C8A5FC]/10 dark:bg-[#C8A5FC]/15'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              "
            >
              <div class="flex items-start gap-3">
                <input
                  type="radio"
                  name="joinChoice"
                  value="new"
                  v-model="joinChoice"
                  class="mt-1 text-[#C8A5FC] focus:ring-[#C8A5FC]"
                />
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-sm dark:text-white flex items-center gap-2">
                    <span>{{ $t("join.joinAsNew") }}</span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ $t("join.joinAsNewDesc") }}
                  </p>
                  <div class="mt-2 flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                    <img
                      v-if="authStore.user.photoURL"
                      :src="authStore.user.photoURL"
                      class="w-5 h-5 rounded-full"
                      alt=""
                    />
                    <div
                      v-else
                      class="w-5 h-5 rounded-full bg-[#C8A5FC] text-white flex items-center justify-center text-[10px]"
                    >
                      {{ (authStore.userProfile?.nickname || authStore.user.displayName || 'U').charAt(0) }}
                    </div>
                    <span class="truncate">{{ authStore.userProfile?.nickname || authStore.user.displayName }}</span>
                  </div>
                </div>
              </div>
            </label>

            <!-- Option 2: Claim existing profile -->
            <label
              class="block p-3.5 rounded-xl border-2 cursor-pointer transition-all"
              :class="
                joinChoice === 'claim'
                  ? 'border-[#C8A5FC] bg-[#C8A5FC]/10 dark:bg-[#C8A5FC]/15'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              "
            >
              <div class="flex items-start gap-3">
                <input
                  type="radio"
                  name="joinChoice"
                  value="claim"
                  v-model="joinChoice"
                  class="mt-1 text-[#C8A5FC] focus:ring-[#C8A5FC]"
                />
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-sm dark:text-white">
                    {{ $t("join.claimExisting") }}
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">
                    {{ $t("join.claimExistingDesc") }}
                  </p>

                  <!-- Member choice list when claim is selected -->
                  <div class="space-y-1.5 mt-2">
                    <div
                      v-for="member in unclaimedMembers"
                      :key="member.id"
                      @click.stop="selectedClaimMemberId = member.id; joinChoice = 'claim'"
                      class="flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer"
                      :class="
                        joinChoice === 'claim' && selectedClaimMemberId === member.id
                          ? 'border-[#C8A5FC] bg-white dark:bg-surface-dark shadow-xs font-semibold'
                          : 'border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-surface-dark'
                      "
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <div class="w-6 h-6 rounded-full bg-[#C8A5FC] flex items-center justify-center text-white text-xs shrink-0">
                          {{ member.displayName.charAt(0).toUpperCase() }}
                        </div>
                        <span class="text-xs dark:text-gray-200 truncate">{{ member.displayName }}</span>
                        <span class="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded font-normal">
                          {{ $t('common.noAccount') }}
                        </span>
                      </div>
                      <i
                        v-if="joinChoice === 'claim' && selectedClaimMemberId === member.id"
                        class="fas fa-check text-xs text-[#8A5FBF] dark:text-[#C8A5FC] mr-1"
                      ></i>
                    </div>
                  </div>
                </div>
              </div>
            </label>
          </div>

          <!-- Submit Join / Claim Button -->
          <button
            @click="handleJoin"
            :disabled="loading || (joinChoice === 'claim' && !selectedClaimMemberId)"
            class="w-full px-4 py-3 bg-[#C8A5FC] text-white font-semibold rounded-xl hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs"
          >
            <i v-if="loading" class="fas fa-spinner fa-spin"></i>
            <span>
              {{
                joinChoice === "claim"
                  ? $t("join.confirmClaim")
                  : $t("join.confirmJoin")
              }}
            </span>
          </button>
        </div>

        <!-- ── Unauthenticated: Sign in with Google ──────────────────────── -->
        <div v-else class="space-y-3">
          <button
            @click="handleSignIn"
            :disabled="signingIn"
            class="w-full px-4 py-3 bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 font-semibold shadow-xs"
          >
            <i v-if="signingIn" class="fas fa-spinner fa-spin"></i>
            <svg
              v-else
              class="w-4 h-4"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {{ $t("join.signInToJoin") }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

