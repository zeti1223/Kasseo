<script setup>
import { ref, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useGroupsStore } from "@/stores/groups";
import { CURRENCIES } from "@/constants/currencies";

const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(["update:modelValue", "open-import"]);

const router = useRouter();
const groupsStore = useGroupsStore();

const name = ref("");
const currency = ref("USD");
const loading = ref(false);
const currencies = CURRENCIES;
const nameInput = ref(null);

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => {
        nameInput.value?.focus();
      });
    }
  },
);

function handleOpenImport() {
  emit("update:modelValue", false);
  emit("open-import");
}

async function handleCreate() {
  if (!name.value.trim()) return;
  loading.value = true;
  try {
    const id = await groupsStore.createGroup(name.value.trim(), currency.value);
    name.value = "";
    emit("update:modelValue", false);
    router.push({ name: "group", params: { id } });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    v-if="props.modelValue"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
  >
    <div
      class="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      @click="emit('update:modelValue', false)"
    />
    <div
      class="relative bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-none sm:max-w-[420px] max-h-[90vh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pb-6"
    >
      <!-- Mobile drag handle indicator -->
      <div class="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

      <h2 class="text-lg font-semibold font-display mb-4 dark:text-white">
        {{ $t('groups.newFundTitle') }}
      </h2>
      <div class="space-y-4">
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >{{ $t('groups.fundName') }}</label
          >
          <input
            ref="nameInput"
            v-model="name"
            type="text"
            :placeholder="$t('groups.fundNamePlaceholder')"
            class="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
            @keyup.enter="handleCreate"
          />
        </div>
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >{{ $t('common.currency') }}</label
          >
          <select
            v-model="currency"
            class="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option v-for="curr in currencies" :key="curr" :value="curr">
              {{ curr }}
            </option>
          </select>
        </div>

        <!-- Quick Import Link -->
        <div class="pt-2 text-center border-t border-gray-100 dark:border-gray-700/60">
          <button
            type="button"
            @click="handleOpenImport"
            class="text-xs text-primary hover:text-primary-dark font-medium inline-flex items-center gap-1.5 hover:underline"
          >
            <i class="fas fa-file-import"></i>
            <span>{{ $t('import.quickImport') }}</span>
          </button>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-6">
        <button
          @click="emit('update:modelValue', false)"
          class="flex-1 sm:flex-initial px-4 py-2.5 sm:py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-center"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="handleCreate"
          :disabled="!name.trim() || loading"
          class="flex-1 sm:flex-initial px-5 py-2.5 sm:py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
        >
          <i v-if="loading" class="fas fa-spinner fa-spin h-4 w-4"></i>
          {{ $t('common.create') }}
        </button>
      </div>
    </div>
  </div>
</template>
