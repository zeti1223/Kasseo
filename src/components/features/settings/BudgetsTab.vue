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
  const existingRollover = budgetByName.value[category.name]?.rollover || false;
  emit("save", {
    name: category.name,
    icon: category.icon,
    amount,
    rollover: existingRollover,
  });
  const { [category.name]: _removed, ...rest } = drafts.value;
  drafts.value = rest;
}

function clear(category) {
  if (props.loading) return;
  emit("clear", category.name);
  const { [category.name]: _removed, ...rest } = drafts.value;
  drafts.value = rest;
}

// Flips the rollover flag on an already-saved budget. Applies immediately
// (no separate save step) since it's a toggle, not a typed value.
function toggleRollover(category) {
  const saved = budgetByName.value[category.name];
  if (!saved || props.loading) return;
  emit("save", {
    name: category.name,
    icon: category.icon,
    amount: saved.amount,
    rollover: !saved.rollover,
  });
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
        class="p-3 bg-gray-50/80 dark:bg-gray-700/60 rounded-xl border border-gray-100 dark:border-gray-600/40 transition-all"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 shrink-0 rounded-full bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center text-xs shadow-sm"
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
                class="w-24 px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-800 dark:text-white transition-colors"
              />
              <span class="text-xs text-gray-500 dark:text-gray-400 w-8 shrink-0">{{
                currency
              }}</span>
              <button
                v-if="hasUnsavedChange(category.name)"
                @click="save(category)"
                :disabled="loading"
                :title="$t('common.save')"
                class="bg-[#8A5FBF] hover:bg-[#784fa8] text-white rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <i class="fas fa-check text-xs"></i>
              </button>
              <button
                v-else-if="budgetByName[category.name]"
                @click="clear(category)"
                :disabled="loading"
                :title="$t('fundSettings.clearBudget')"
                class="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg p-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i class="fas fa-trash text-xs"></i>
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

        <!-- Rollover opt-in: only relevant once a budget is actually saved. -->
        <div
          v-if="budgetByName[category.name] && !hasUnsavedChange(category.name)"
          class="mt-2.5 pt-2 border-t border-gray-200/60 dark:border-gray-600/50 flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
              :class="budgetByName[category.name].rollover ? 'bg-[#C8A5FC]/25 text-[#8A5FBF] dark:text-[#C8A5FC]' : 'bg-gray-200/60 dark:bg-gray-600 text-gray-400 dark:text-gray-400'"
            >
              <i class="fas fa-arrows-rotate text-[10px]"></i>
            </div>
            <span class="text-xs text-gray-600 dark:text-gray-300 select-none">
              {{ $t('fundSettings.budgetRollover') }}
            </span>
          </div>

          <button
            v-if="canEdit"
            type="button"
            role="switch"
            :aria-checked="!!budgetByName[category.name].rollover"
            :disabled="loading"
            @click="toggleRollover(category)"
            :title="$t('fundSettings.budgetRollover')"
            class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:ring-offset-1 dark:focus:ring-offset-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="budgetByName[category.name].rollover ? 'bg-[#8A5FBF] dark:bg-[#A67EE4]' : 'bg-gray-300 dark:bg-gray-600'"
          >
            <span
              class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition duration-200 ease-in-out"
              :class="budgetByName[category.name].rollover ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
          <span
            v-else-if="budgetByName[category.name].rollover"
            class="inline-flex items-center gap-1 text-[11px] font-medium text-[#8A5FBF] dark:text-[#C8A5FC] bg-[#C8A5FC]/15 px-2 py-0.5 rounded-full"
          >
            <i class="fas fa-check text-[9px]"></i>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
