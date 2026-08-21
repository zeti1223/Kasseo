<script setup>
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { useNotificationsStore } from "@/stores/notifications";
import { useTranslation } from "i18next-vue";
import LanguageSelector from "@/components/common/LanguageSelector.vue";

const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(["update:modelValue"]);

const router = useRouter();
const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();
const { t } = useTranslation();

const nickname = ref("");
const isEditingNickname = ref(false);
const saveMessage = ref("");
const avatarFailed = ref(false);
const permissionStatus = computed(() => notificationsStore.permission);

watch(
  () => authStore.user?.photoURL,
  () => {
    avatarFailed.value = false;
  },
);

const themeOptions = computed(() => [
  { value: "light", label: t("settings.themeLight") },
  { value: "system", label: t("settings.themeAuto") },
  { value: "dark", label: t("settings.themeDark") },
]);

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      settingsStore.loadSettings();
      nickname.value =
        authStore.userProfile?.nickname || authStore.user?.displayName || "";
    }
  },
);

async function saveNickname() {
  if (nickname.value.trim()) {
    await authStore.updateNickname(nickname.value.trim());
    settingsStore.setNickname(nickname.value.trim());
    isEditingNickname.value = false;
    saveMessage.value = t("settings.nicknameSaved");
    setTimeout(() => (saveMessage.value = ""), 2000);
  }
}

function cancelEdit() {
  nickname.value =
    authStore.userProfile?.nickname || authStore.user?.displayName || "";
  isEditingNickname.value = false;
}

async function handleSignOut() {
  await authStore.logout();
  router.push({ name: "landing" });
}

async function handleRequestPermission() {
  await notificationsStore.askPermission();
}

function handleSendTestNotification() {
  notificationsStore.sendTestNotification(t);
}
</script>

<template>
  <div
    v-if="props.modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center"
  >
    <div
      class="absolute inset-0 bg-black/50"
      @click="emit('update:modelValue', false)"
    />
    <div
      class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[500px] mx-4 max-h-[90vh] overflow-y-auto"
    >
      <h2 class="text-lg font-semibold font-display mb-4 dark:text-white">
        {{ $t('settings.title') }}
      </h2>

      <div class="space-y-4">
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 class="text-md font-semibold mb-3 font-display dark:text-white">
            {{ $t('settings.appearance') }}
          </h3>

          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium dark:text-white">{{ $t('settings.theme') }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {{ $t('settings.themeDescription') }}
              </div>
            </div>
            <div
              class="inline-flex items-center rounded-lg bg-gray-200 dark:bg-gray-600 p-1 gap-1"
            >
              <button
                v-for="option in themeOptions"
                :key="option.value"
                type="button"
                @click="settingsStore.setThemeMode(option.value)"
                :aria-pressed="settingsStore.themeMode === option.value"
                :title="option.label"
                class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                :class="
                  settingsStore.themeMode === option.value
                    ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                    : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
                "
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Profile -->
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 class="text-md font-semibold mb-3 font-display dark:text-white">
            {{ $t('settings.profile') }}
          </h3>

          <div class="flex items-center gap-3 mb-4">
            <img
              v-if="authStore.user?.photoURL && !avatarFailed"
              :src="authStore.user.photoURL"
              :alt="
                authStore.userProfile?.nickname || authStore.user?.displayName
              "
              class="w-12 h-12 rounded-full object-cover"
              @error="avatarFailed = true"
            />
            <div
              v-else
              class="w-12 h-12 rounded-full bg-[#C8A5FC] flex items-center justify-center text-white text-lg font-medium flex-shrink-0"
            >
              {{
                (authStore.userProfile?.nickname || authStore.user?.displayName)
                  ?.charAt(0)
                  .toUpperCase() || "?"
              }}
            </div>
            <div>
              <div class="font-medium dark:text-white">
                {{
                  authStore.userProfile?.nickname || authStore.user?.displayName
                }}
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {{ authStore.user?.email }}
              </div>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-600 pt-3">
            <div class="flex items-center justify-between mb-2">
              <div>
                <div class="font-medium dark:text-white">{{ $t('settings.nickname') }}</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('settings.nicknameDescription') }}
                </div>
              </div>
              <button
                v-if="!isEditingNickname"
                @click="isEditingNickname = true"
                class="text-primary hover:text-primary-dark dark:hover:text-primary-dark-dark px-3 py-1 rounded-lg transition-colors"
              >
                {{ $t('common.edit') }}
              </button>
            </div>

            <div v-if="isEditingNickname" class="flex items-center gap-2 mt-2">
              <input
                v-model="nickname"
                type="text"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                :placeholder="$t('settings.nicknamePlaceholder')"
                @keyup.enter="saveNickname"
              />
              <button
                @click="saveNickname"
                class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark dark:hover:bg-primary-dark-dark transition-colors"
              >
                {{ $t('common.save') }}
              </button>
              <button
                @click="cancelEdit"
                class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors dark:text-white"
              >
                {{ $t('common.cancel') }}
              </button>
            </div>
            <div v-else class="mt-2">
              <div class="text-lg font-medium dark:text-white">
                {{
                  authStore.userProfile?.nickname || authStore.user?.displayName
                }}
              </div>
              <div v-if="saveMessage" class="text-sm text-success mt-1">
                {{ saveMessage }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Notifications -->
      <div v-if="notificationsStore.isSupported" class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mt-4">
        <h3 class="text-md font-semibold mb-3 font-display dark:text-white">
          {{ $t('notifications.title') }}
        </h3>

        <!-- Permission status -->
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="font-medium dark:text-white">{{ $t('notifications.permission') }}</div>
            <div class="text-sm mt-0.5" :class="{
              'text-green-600 dark:text-green-400': permissionStatus === 'granted',
              'text-red-500 dark:text-red-400': permissionStatus === 'denied',
              'text-gray-500 dark:text-gray-400': permissionStatus === 'default',
            }">
              <span v-if="permissionStatus === 'granted'">
                <i class="fas fa-check-circle mr-1" /> {{ $t('notifications.enabled') }}
              </span>
              <span v-else-if="permissionStatus === 'denied'">
                <i class="fas fa-ban mr-1" /> {{ $t('notifications.denied') }}
              </span>
              <span v-else>
                <i class="fas fa-bell-slash mr-1" /> {{ $t('notifications.notRequested') }}
              </span>
            </div>
          </div>
          <button
            v-if="permissionStatus !== 'granted' && permissionStatus !== 'denied'"
            @click="handleRequestPermission"
            class="px-3 py-1.5 bg-[#C8A5FC] text-white rounded-lg text-sm hover:bg-[#b48df0] transition-colors"
          >
            {{ $t('notifications.enable') }}
          </button>
        </div>

        <!-- Push toggle (only when granted) -->
        <div v-if="permissionStatus === 'granted'" class="space-y-3 border-t border-gray-200 dark:border-gray-600 pt-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium dark:text-white">{{ $t('notifications.pushLabel') }}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">{{ $t('notifications.pushDescription') }}</div>
            </div>
            <button
              role="switch"
              :aria-checked="notificationsStore.pushEnabled"
              @click="notificationsStore.togglePush(!notificationsStore.pushEnabled)"
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none"
              :class="notificationsStore.pushEnabled ? 'bg-[#C8A5FC]' : 'bg-gray-300 dark:bg-gray-600'"
            >
              <span
                class="inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform"
                :class="notificationsStore.pushEnabled ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>

          <div v-if="notificationsStore.pushEnabled" class="flex justify-end pt-1">
            <button
              type="button"
              @click="handleSendTestNotification"
              class="text-xs px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <i class="fas fa-paper-plane text-[10px]" />
              {{ $t('notifications.testButton') }}
            </button>
          </div>
        </div>
      </div>

      <div class="flex justify-between gap-2 mt-6">
        <button
          @click="handleSignOut"
          class="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
        >
          <i class="fas fa-sign-out-alt"></i>
          {{ $t('navbar.signOut') }}
        </button>
        <button
          @click="emit('update:modelValue', false)"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <i class="fas fa-times"></i>
          {{ $t('common.close') }}
        </button>
      </div>
    </div>
  </div>
</template>
