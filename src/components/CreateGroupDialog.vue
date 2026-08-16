<script setup>
import { ref, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useGroupsStore } from "@/stores/groups";

const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(["update:modelValue"]);

const router = useRouter();
const groupsStore = useGroupsStore();

const name = ref("");
const currency = ref("USD");
const loading = ref(false);
const currencies = ["USD", "EUR", "HUF", "GBP"];
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
    class="fixed inset-0 z-50 flex items-center justify-center"
  >
    <div
      class="absolute inset-0 bg-black/50"
      @click="emit('update:modelValue', false)"
    />
    <div
      class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[420px] mx-4"
    >
      <h2 class="text-lg font-semibold font-display mb-4 dark:text-white">
        New shared fund
      </h2>
      <div class="space-y-4">
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >Fund name</label
          >
          <input
            ref="nameInput"
            v-model="name"
            type="text"
            placeholder="e.g. Roommates fund"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
            @keyup.enter="handleCreate"
          />
        </div>
        <div>
          <label
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >Currency</label
          >
          <select
            v-model="currency"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option v-for="curr in currencies" :key="curr" :value="curr">
              {{ curr }}
            </option>
          </select>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-6">
        <button
          @click="emit('update:modelValue', false)"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          @click="handleCreate"
          :disabled="!name.trim() || loading"
          class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <i v-if="loading" class="fas fa-spinner fa-spin h-4 w-4"></i>
          Create
        </button>
      </div>
    </div>
  </div>
</template>
