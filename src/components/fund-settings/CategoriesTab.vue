<script setup>
defineProps({
  categories: { type: Array, required: true },
  newCategory: { type: String, default: "" },
  isOwner: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});
defineEmits(["update:newCategory", "add", "remove"]);
</script>

<template>
  <div class="space-y-4">
    <div v-if="isOwner" class="flex gap-2">
      <input
        :value="newCategory"
        @input="$emit('update:newCategory', $event.target.value)"
        type="text"
        placeholder="New category name"
        class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
        @keyup.enter="$emit('add')"
      />
      <button
        @click="$emit('add')"
        :disabled="!newCategory.trim() || loading"
        class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>
    <p v-if="!isOwner" class="text-xs text-gray-500 dark:text-gray-400">
      Only the owner can add categories
    </p>

    <div class="space-y-2">
      <div
        v-for="category in categories"
        :key="category.id"
        class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
      >
        <span class="text-sm dark:text-white">{{ category.name }}</span>
        <button
          v-if="isOwner"
          @click="$emit('remove', category.id)"
          class="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1"
        >
          <i class="fas fa-trash"></i>
          Remove
        </button>
      </div>
      <div
        v-if="categories.length === 0"
        class="text-sm text-gray-500 dark:text-gray-400 text-center py-4"
      >
        No custom categories yet
      </div>
    </div>
  </div>
</template>
