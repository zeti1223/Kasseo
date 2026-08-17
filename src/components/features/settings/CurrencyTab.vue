<script setup>
defineProps({
  currency: { type: String, required: true },
  currencies: { type: Array, required: true },
  isOwner: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});
defineEmits(["update:currency", "save", "cancel"]);
</script>

<template>
  <div class="space-y-4">
    <div>
      <label
        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >Current currency</label
      >
      <select
        :value="currency"
        @change="$emit('update:currency', $event.target.value)"
        :disabled="!isOwner"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white"
      >
        <option v-for="curr in currencies" :key="curr" :value="curr">
          {{ curr }}
        </option>
      </select>
      <p v-if="!isOwner" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Only the owner can change currency
      </p>
    </div>
    <div v-if="isOwner" class="flex justify-end gap-2">
      <button
        @click="$emit('cancel')"
        class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <button
        @click="$emit('save')"
        :disabled="loading"
        class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save
      </button>
    </div>
  </div>
</template>
