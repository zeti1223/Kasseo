<script setup>
import { ref, watch } from "vue";
import { useTranslation } from "i18next-vue";
import { useAppLockStore } from "@/stores/appLock";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // "create": no existing PIN, straight to new+confirm.
  // "change": must verify the existing PIN before choosing a new one.
  // "disable": must verify the existing PIN, then turns the lock off.
  mode: { type: String, default: "create" },
});
const emit = defineEmits(["update:modelValue", "success"]);

const appLockStore = useAppLockStore();
const { t } = useTranslation();

const step = ref("new");
const currentPin = ref("");
const newPin = ref("");
const confirmPin = ref("");
const error = ref("");

function reset() {
  step.value = props.mode === "create" ? "new" : "current";
  currentPin.value = "";
  newPin.value = "";
  confirmPin.value = "";
  error.value = "";
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) reset();
  },
);

function sanitize(value) {
  return value.replace(/\D/g, "").slice(0, 6);
}

async function submitCurrent() {
  const ok = await appLockStore.verifyPin(currentPin.value);
  if (!ok) {
    error.value = t("appLock.wrongPin");
    currentPin.value = "";
    return;
  }
  error.value = "";
  if (props.mode === "disable") {
    appLockStore.disableLock();
    emit("success");
    emit("update:modelValue", false);
    return;
  }
  step.value = "new";
}

function submitNew() {
  if (newPin.value.length !== 6) return;
  error.value = "";
  step.value = "confirm";
}

async function submitConfirm() {
  if (confirmPin.value !== newPin.value) {
    error.value = t("appLock.pinMismatch");
    confirmPin.value = "";
    return;
  }
  await appLockStore.setPin(newPin.value);
  emit("success");
  emit("update:modelValue", false);
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-[60] flex items-center justify-center"
  >
    <div
      class="absolute inset-0 bg-black/50"
      @click="emit('update:modelValue', false)"
    />
    <div
      class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[360px] mx-4"
    >
      <h3 class="text-md font-semibold font-display mb-4 dark:text-white">
        {{ mode === "disable" ? t("appLock.disableTitle") : t("appLock.setupTitle") }}
      </h3>

      <div v-if="step === 'current'">
        <label class="block text-sm text-gray-500 dark:text-gray-400 mb-2">
          {{ t("appLock.enterCurrentPin") }}
        </label>
        <input
          :value="currentPin"
          @input="currentPin = sanitize($event.target.value)"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          maxlength="6"
          autofocus
          class="w-full text-center tracking-[0.5em] text-xl px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          @keyup.enter="submitCurrent"
        />
      </div>

      <div v-else-if="step === 'new'">
        <label class="block text-sm text-gray-500 dark:text-gray-400 mb-2">
          {{ t("appLock.enterNewPin") }}
        </label>
        <input
          :value="newPin"
          @input="newPin = sanitize($event.target.value)"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          maxlength="6"
          autofocus
          class="w-full text-center tracking-[0.5em] text-xl px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          @keyup.enter="submitNew"
        />
      </div>

      <div v-else-if="step === 'confirm'">
        <label class="block text-sm text-gray-500 dark:text-gray-400 mb-2">
          {{ t("appLock.confirmNewPin") }}
        </label>
        <input
          :value="confirmPin"
          @input="confirmPin = sanitize($event.target.value)"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          maxlength="6"
          autofocus
          class="w-full text-center tracking-[0.5em] text-xl px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          @keyup.enter="submitConfirm"
        />
      </div>

      <p v-if="error" class="text-sm text-error mt-2">{{ error }}</p>

      <div class="flex justify-end gap-2 mt-5">
        <button
          type="button"
          @click="emit('update:modelValue', false)"
          class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors dark:text-white"
        >
          {{ t("common.cancel") }}
        </button>
        <button
          v-if="step === 'current'"
          type="button"
          :disabled="currentPin.length !== 6"
          @click="submitCurrent"
          class="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {{ t("common.confirm") }}
        </button>
        <button
          v-else-if="step === 'new'"
          type="button"
          :disabled="newPin.length !== 6"
          @click="submitNew"
          class="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {{ t("common.confirm") }}
        </button>
        <button
          v-else
          type="button"
          :disabled="confirmPin.length !== 6"
          @click="submitConfirm"
          class="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {{ t("common.confirm") }}
        </button>
      </div>
    </div>
  </div>
</template>
