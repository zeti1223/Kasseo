<script setup>
import { ref, computed } from "vue";
import { useTranslation } from "i18next-vue";
import { CATEGORIES, getCategoryIcon, getCategoryLabel } from "@/constants/categories";

const props = defineProps({
  // Custom categories from `groups/{id}/categories` ({ id, name, icon }).
  customCategories: { type: Array, default: () => [] },
  // Raw `groups/{id}/categoryBudgets` map (opaque keys -> { name, amount, icon }).
  categoryBudgets: { type: Object, default: () => ({}) },
  currency: { type: String, default: "" },
  isOwner: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});
// `save` -> { name, icon, amount }; `clear` -> categoryName
const emit = defineEmits(["save", "clear"]);
const { t } = useTranslation();

const canEdit = computed(() => props.isAdmin || props.isOwner);

// Built-in categories a user can already pick when logging an expense, plus
// this fund's custom ones — merged into a single editable list so a budget
// can be set on any category, not just custom ones.
const allCategories = computed(() => {
  const custom = props.customCategories.map((c) => ({
    name: c.name,
    icon: c.icon,
    label: c.name,
  }));
  const customNames = new Set(custom.map((c) => c.name));
  const builtins = CATEGORIES.filter((name) => !customNames.has(name)).map(
    (name) => ({
      name,
      icon: getCategoryIcon(name),
      label: getCategoryLabel(name, t),
    }),
  );
  return [...builtins, ...custom];
});

const budgetByName = computed(() => {
  const map = {};
  for (const budget of Object.values(props.categoryBudgets || {})) {
    if (budget?.name) map[budget.name] = budget;
  }
  return map;
});

// Amount currently being typed per category name, while it differs from
// what's saved (keeps the input responsive without round-tripping to Firebase
// on every keystroke).
const drafts = ref({});

function draftValue(name) {
  if (drafts.value[name] !== undefined) return drafts.value[name];
  const saved = budgetByName.value[name];
  return saved ? String(saved.amount) : "";
}

function onInput(name, value) {
  drafts.value = { ...drafts.value, [name]: value };
}

function hasUnsavedChange(name) {
  if (drafts.value[name] === undefined) return false;
  const saved = budgetByName.value[name];
  const savedStr = saved ? String(saved.amount) : "";
  return drafts.value[name] !== savedStr;
}

function save(category) {
  const raw = draftValue(category.name).trim();
  const amount = Number(raw);
  if (!raw || isNaN(amount) || amount <= 0 || props.loading) return;
  emit("save", { name: category.name, icon: category.icon, amount });
  const { [category.name]: _removed, ...rest } = drafts.value;
  drafts.value = rest;
}

function clear(category) {
  if (props.loading) return;
  emit("clear", category.name);
  const { [category.name]: _removed, ...rest } = drafts.value;
  drafts.value = rest;
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-xs text-gray-500 dark:text-gray-400">
      {{ $t('fundSettings.budgetsHelp') }}
    </p>
    <p v-if="!canEdit" class="text-xs text-gray-500 dark:text-gray-400">
      {{ $t('fundSettings.adminOnlyBudgets') }}
    </p>

    <div class="space-y-2 max-h-72 overflow-y-auto">
      <div
        v-for="category in allCategories"
        :key="category.name"
        class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
      >
        <div
          class="w-8 h-8 shrink-0 rounded-full bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center text-xs"
        >
          <i :class="getCategoryIcon(category.name, category.icon)"></i>
        </div>
        <span class="flex-1 text-sm font-medium dark:text-white truncate">{{
          category.label
        }}</span>

        <template v-if="canEdit">
          <div class="flex items-center gap-1.5">
            <input
              :value="draftValue(category.name)"
              @input="onInput(category.name, $event.target.value)"
              @keyup.enter="save(category)"
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              :placeholder="$t('fundSettings.noBudget')"
              class="w-24 px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-800 dark:text-white"
            />
            <span class="text-xs text-gray-500 dark:text-gray-400 w-10 shrink-0">{{
              currency
            }}</span>
            <button
              v-if="hasUnsavedChange(category.name)"
              @click="save(category)"
              :disabled="loading"
              :title="$t('common.save')"
              class="text-[#8A5FBF] dark:text-[#C8A5FC] hover:bg-[#C8A5FC]/20 rounded-lg px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i class="fas fa-check"></i>
            </button>
            <button
              v-else-if="budgetByName[category.name]"
              @click="clear(category)"
              :disabled="loading"
              :title="$t('fundSettings.clearBudget')"
              class="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </template>
        <span
          v-else-if="budgetByName[category.name]"
          class="text-sm text-gray-600 dark:text-gray-300"
        >
          {{ budgetByName[category.name].amount }} {{ currency }}
        </span>
        <span v-else class="text-xs text-gray-400 dark:text-gray-500">
          {{ $t('fundSettings.noBudget') }}
        </span>
      </div>
    </div>
  </div>
</template>
