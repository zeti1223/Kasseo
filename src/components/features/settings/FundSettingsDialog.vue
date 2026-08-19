<script setup>
import { ref, computed, watch } from "vue";
import { useGroupsStore } from "@/stores/groups";
import { useTransactionsStore } from "@/stores/transactions";
import { useAuthStore } from "@/stores/auth";
import { ref as dbRef, get } from "firebase/database";
import { db } from "@/services/firebase/config";
import { CURRENCIES } from "@/constants/currencies";
import ConfirmDialog from "../../common/ConfirmDialog.vue";
import CurrencyTab from "./CurrencyTab.vue";
import ModeTab from "./ModeTab.vue";
import MembersTab from "./MembersTab.vue";
import CategoriesTab from "./CategoriesTab.vue";

const props = defineProps({ modelValue: Boolean, group: Object });
const emit = defineEmits(["update:modelValue"]);

const groupsStore = useGroupsStore();
const transactionsStore = useTransactionsStore();
const authStore = useAuthStore();

const tabs = [
  { id: "currency", label: "Currency" },
  { id: "mode", label: "Mode" },
  { id: "members", label: "Members" },
  { id: "categories", label: "Categories" },
];
const activeTab = ref("currency");

const currency = ref("USD");
const currencies = CURRENCIES;
const mode = ref("kitty");
const modes = [
  {
    value: "kitty",
    label: "Kitty",
    description:
      "Everyone deposits money into one shared pot. Expenses come out of that pot, and the fund tracks a single running balance.",
  },
  {
    value: "split",
    label: "Split",
    description:
      "No deposits. Every expense is split between members automatically, and members settle up directly with each other.",
  },
];
const loading = ref(false);
const recalcProgress = ref(null); // { done, total } while reconverting transactions
const recalcFailedCount = ref(0); // set after a run that left some transactions unconverted

const newCategory = ref("");
const categories = ref([]);

const removeMemberTarget = ref(null);
const removeCategoryTarget = ref(null);

const isOwner = computed(() => props.group?.ownerId === authStore.user?.uid);

const members = computed(() => {
  if (!props.group?.members) return [];
  return Object.entries(props.group.members).map(([id, member]) => ({
    id,
    ...member,
    displayName: member.nickname || member.displayName || "Someone",
  }));
});

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.group) {
      currency.value = props.group.currency;
      mode.value = props.group.mode || "kitty";
      loadCategories();
    }
  },
);

async function loadCategories() {
  if (!props.group?.id) return;
  const snap = await get(dbRef(db, `groups/${props.group.id}/categories`));
  categories.value = snap.exists()
    ? Object.entries(snap.val()).map(([id, cat]) => ({ id, ...cat }))
    : [];
}

async function handleCurrencyChange() {
  if (!props.group?.id) return;
  const newCurrency = currency.value;
  const changed = newCurrency !== props.group.currency;
  loading.value = true;
  recalcFailedCount.value = 0;
  try {
    if (changed) {
      await runRecalculation(newCurrency);
    }
    await groupsStore.loadGroup(props.group.id);
    // If some transactions failed to reconvert, keep the dialog open
    // so the retry notice is visible.
    if (recalcFailedCount.value === 0) {
      emit("update:modelValue", false);
    }
  } finally {
    loading.value = false;
    recalcProgress.value = null;
  }
}

// Pulled out so "Retry" can rerun the same conversion pass safely.
async function runRecalculation(newCurrency) {
  await groupsStore.updateCurrency(props.group.id, newCurrency);
  recalcProgress.value = { done: 0, total: 0 };
  const failed = await transactionsStore.recalculateForCurrency(
    props.group.id,
    newCurrency,
    (done, total) => {
      recalcProgress.value = { done, total };
    },
  );
  recalcFailedCount.value = failed.length;
}

async function retryRecalculation() {
  loading.value = true;
  try {
    await runRecalculation(currency.value);
    await groupsStore.loadGroup(props.group.id);
    if (recalcFailedCount.value === 0) {
      emit("update:modelValue", false);
    }
  } finally {
    loading.value = false;
    recalcProgress.value = null;
  }
}

async function handleModeChange(newMode) {
  if (!props.group?.id || newMode === (props.group.mode || "kitty")) return;
  mode.value = newMode;
  loading.value = true;
  try {
    await groupsStore.updateMode(props.group.id, newMode);
    await groupsStore.loadGroup(props.group.id);
  } finally {
    loading.value = false;
  }
}

async function handleAddCategory(payload) {
  const catName =
    typeof payload === "object" && payload?.name
      ? payload.name
      : newCategory.value.trim();
  const icon =
    typeof payload === "object" && payload?.icon ? payload.icon : null;
  if (!catName || !props.group?.id) return;
  loading.value = true;
  try {
    await groupsStore.addCategory(props.group.id, catName, icon);
    newCategory.value = "";
    await loadCategories();
  } finally {
    loading.value = false;
  }
}

async function confirmRemoveCategory() {
  if (!props.group?.id || !removeCategoryTarget.value) return;
  loading.value = true;
  try {
    await groupsStore.removeCategory(
      props.group.id,
      removeCategoryTarget.value,
    );
    await loadCategories();
    removeCategoryTarget.value = null;
  } finally {
    loading.value = false;
  }
}

async function confirmRemoveMember() {
  if (!props.group?.id || !removeMemberTarget.value) return;
  loading.value = true;
  try {
    await groupsStore.removeMember(props.group.id, removeMemberTarget.value);
    removeMemberTarget.value = null;
  } finally {
    loading.value = false;
  }
}

const inviteUrl = computed(() => {
  if (!props.group?.id) return "";
  return `${window.location.origin}/join/${props.group.id}`;
});

function copyInviteLink() {
  if (!props.group?.id) return;
  navigator.clipboard.writeText(inviteUrl.value);
}
</script>

<template>
  <div
    v-if="props.modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center"
  >
    <div
      class="absolute inset-0 bg-black/50"
      @click="!loading && emit('update:modelValue', false)"
    />
    <div
      class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[500px] mx-4"
    >
      <h2 class="text-lg font-semibold font-display mb-4 dark:text-white">
        Fund Settings
      </h2>

      <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'border-b-2 border-[#C8A5FC] text-[#C8A5FC]'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
          ]"
        >
          {{ tab.label }}
        </button>
      </div>

      <CurrencyTab
        v-if="activeTab === 'currency'"
        v-model:currency="currency"
        :currencies="currencies"
        :is-owner="isOwner"
        :loading="loading"
        :recalc-progress="recalcProgress"
        :recalc-failed-count="recalcFailedCount"
        @save="handleCurrencyChange"
        @retry="retryRecalculation"
        @cancel="emit('update:modelValue', false)"
      />

      <ModeTab
        v-if="activeTab === 'mode'"
        :mode="mode"
        :modes="modes"
        :is-owner="isOwner"
        :loading="loading"
        @change="handleModeChange"
      />

      <MembersTab
        v-if="activeTab === 'members'"
        :members="members"
        :owner-id="props.group?.ownerId"
        :current-user-id="authStore.user?.uid"
        :is-owner="isOwner"
        :invite-url="inviteUrl"
        @copy-invite="copyInviteLink"
        @remove="(id) => (removeMemberTarget = id)"
      />

      <CategoriesTab
        v-if="activeTab === 'categories'"
        v-model:new-category="newCategory"
        :categories="categories"
        :is-owner="isOwner"
        :loading="loading"
        @add="handleAddCategory"
        @remove="(id) => (removeCategoryTarget = id)"
      />

      <div v-if="activeTab !== 'currency'" class="flex justify-end mt-6">
        <button
          @click="emit('update:modelValue', false)"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <i class="fas fa-times"></i>
          Close
        </button>
      </div>
    </div>

    <ConfirmDialog
      :model-value="!!removeMemberTarget"
      @update:model-value="removeMemberTarget = null"
      title="Remove member?"
      confirm-label="Remove"
      danger
      :loading="loading"
      @confirm="confirmRemoveMember"
    >
      This member will lose access to this fund.
    </ConfirmDialog>

    <ConfirmDialog
      :model-value="!!removeCategoryTarget"
      @update:model-value="removeCategoryTarget = null"
      title="Remove category?"
      confirm-label="Remove"
      danger
      :loading="loading"
      @confirm="confirmRemoveCategory"
    >
      This category will be removed from the fund.
    </ConfirmDialog>
  </div>
</template>
