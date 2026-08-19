<script setup>
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";

const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(["update:modelValue"]);

const router = useRouter();
const settingsStore = useSettingsStore();
const authStore = useAuthStore();

const nickname = ref("");
const isEditingNickname = ref(false);
const saveMessage = ref("");

const themeOptions = [
  { value: "light", label: "Light" },
  { value: "system", label: "Auto" },
  { value: "dark", label: "Dark" },
];

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
    saveMessage.value = "Nickname saved!";
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
        Settings
      </h2>

      <div class="space-y-4">
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 class="text-md font-semibold mb-3 font-display dark:text-white">
            Appearance
          </h3>

          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium dark:text-white">Theme</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                Light, dark, or match your system
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

        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 class="text-md font-semibold mb-3 font-display dark:text-white">
            Profile
          </h3>

          <div class="flex items-center gap-3 mb-4">
            <img
              :src="authStore.user?.photoURL"
              :alt="
                authStore.userProfile?.nickname || authStore.user?.displayName
              "
              class="w-12 h-12 rounded-full object-cover"
            />
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
                <div class="font-medium dark:text-white">Nickname</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  How others see you in the app
                </div>
              </div>
              <button
                v-if="!isEditingNickname"
                @click="isEditingNickname = true"
                class="text-primary hover:text-primary-dark dark:hover:text-primary-dark-dark px-3 py-1 rounded-lg transition-colors"
              >
                Edit
              </button>
            </div>

            <div v-if="isEditingNickname" class="flex items-center gap-2 mt-2">
              <input
                v-model="nickname"
                type="text"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                placeholder="Enter your nickname"
                @keyup.enter="saveNickname"
              />
              <button
                @click="saveNickname"
                class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark dark:hover:bg-primary-dark-dark transition-colors"
              >
                Save
              </button>
              <button
                @click="cancelEdit"
                class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors dark:text-white"
              >
                Cancel
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

      <div class="flex justify-between gap-2 mt-6">
        <button
          @click="handleSignOut"
          class="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
        >
          <i class="fas fa-sign-out-alt"></i>
          Sign Out
        </button>
        <button
          @click="emit('update:modelValue', false)"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <i class="fas fa-times"></i>
          Close
        </button>
      </div>
    </div>
  </div>
</template>
