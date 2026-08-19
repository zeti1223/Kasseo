<script setup>
import { ref } from "vue";
import { getCategoryIcon, PRESET_ICONS } from "@/constants/categories";

const props = defineProps({
  categories: { type: Array, required: true },
  newCategory: { type: String, default: "" },
  isOwner: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});
const emit = defineEmits(["update:newCategory", "add", "remove"]);

const selectedIcon = ref("fas fa-tag");
const showIconPicker = ref(false);

function selectIcon(iconClass) {
  selectedIcon.value = iconClass;
  showIconPicker.value = false;
}

function handleAdd() {
  if (!props.newCategory.trim() || props.loading) return;
  emit("add", { name: props.newCategory.trim(), icon: selectedIcon.value });
  selectedIcon.value = "fas fa-tag";
  showIconPicker.value = false;
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="isOwner" class="space-y-2">
      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
        {{ $t('fundSettings.newCategoryLabel') }}
      </label>
      <div class="flex gap-2">
        <div class="relative">
          <button
            type="button"
            @click="showIconPicker = !showIconPicker"
            class="w-11 h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            :title="$t('fundSettings.chooseIconTooltip')"
          >
            <i :class="selectedIcon" class="text-base"></i>
          </button>

          <!-- Backdrop to close icon picker on outside click -->
          <div
            v-if="showIconPicker"
            class="fixed inset-0 z-40"
            @click="showIconPicker = false"
          />

          <!-- Icon picker popover -->
          <div
            v-if="showIconPicker"
            class="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 shadow-xl w-72 max-h-56 overflow-y-auto grid grid-cols-5 gap-1.5"
          >
            <button
              v-for="item in PRESET_ICONS"
              :key="item.icon"
              type="button"
              @click="selectIcon(item.icon)"
              class="w-10 h-10 rounded-lg flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
              :class="{
                'bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] border border-[#C8A5FC]':
                selectedIcon === item.icon,
              }"
              :title="item.label"
            >
              <i :class="item.icon"></i>
            </button>
          </div>
        </div>

        <input
          :value="newCategory"
          @input="$emit('update:newCategory', $event.target.value)"
          type="text"
          :placeholder="$t('fundSettings.categoryNamePlaceholder')"
          class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
          @keyup.enter="handleAdd"
        />
        <button
          @click="handleAdd"
          :disabled="!newCategory.trim() || loading"
          class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {{ $t('common.add') }}
        </button>
      </div>
    </div>
    <p v-if="!isOwner" class="text-xs text-gray-500 dark:text-gray-400">
      {{ $t('fundSettings.ownerOnlyCategories') }}
    </p>

    <div class="space-y-2 max-h-60 overflow-y-auto">
      <div
        v-for="category in categories"
        :key="category.id"
        class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-full bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center text-xs"
          >
            <i :class="getCategoryIcon(category.name, category.icon)"></i>
          </div>
          <span class="text-sm font-medium dark:text-white">{{
            category.name
          }}</span>
        </div>
        <button
          v-if="isOwner"
          @click="$emit('remove', category.id)"
          class="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1"
        >
          <i class="fas fa-trash"></i>
          {{ $t('common.remove') }}
        </button>
      </div>
      <div
        v-if="categories.length === 0"
        class="text-sm text-gray-500 dark:text-gray-400 text-center py-4"
      >
        {{ $t('fundSettings.noCustomCategories') }}
      </div>
    </div>
  </div>
</template>
