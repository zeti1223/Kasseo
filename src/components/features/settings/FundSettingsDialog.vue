<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useGroupsStore } from "@/stores/groups";
import { useTransactionsStore } from "@/stores/transactions";
import { useAuthStore } from "@/stores/auth";
import { ref as dbRef, get } from "firebase/database";
import { db } from "@/services/firebase/config";
import { getAppBaseUrl } from "@/constants/appUrl";
import { CURRENCIES } from "@/constants/currencies";
import { DEFAULT_FUND_COLOR, DEFAULT_FUND_ICON } from "@/constants/fundStyle";
import { useTranslation } from "i18next-vue";
import ConfirmDialog from "../../common/ConfirmDialog.vue";
import CurrencyTab from "./CurrencyTab.vue";
import ModeTab from "./ModeTab.vue";
import MembersTab from "./MembersTab.vue";
import CategoriesTab from "./CategoriesTab.vue";
import StyleTab from "./StyleTab.vue";

const props = defineProps({ modelValue: Boolean, group: Object });
const emit = defineEmits(["update:modelValue"]);
const { t } = useTranslation();
const router = useRouter();

const groupsStore = useGroupsStore();
const transactionsStore = useTransactionsStore();
const authStore = useAuthStore();

const tabs = computed(() => [
  { id: "currency", label: t("fundSettings.tabCurrency") },
  { id: "mode", label: t("fundSettings.tabMode") },
  { id: "members", label: t("fundSettings.tabMembers") },
  { id: "categories", label: t("fundSettings.tabCategories") },
  { id: "style", label: t("fundSettings.tabStyle") },
]);
const activeTab = ref("currency");

const name = ref("");
const editingName = ref(false);
const savingName = ref(false);
const nameInputRef = ref(null);

const currency = ref("USD");
const currencies = CURRENCIES;
const mode = ref("kitty");
const modes = computed(() => [
  {
    value: "kitty",
    label: t("fundSettings.modeKittyLabel"),
    description: t("fundSettings.modeKittyDesc"),
  },
  {
    value: "split",
    label: t("fundSettings.modeSplitLabel"),
    description: t("fundSettings.modeSplitDesc"),
  },
]);
const loading = ref(false);
const recalcProgress = ref(null); // { done, total } while reconverting transactions
const recalcFailedCount = ref(0); // set after a run that left some transactions unconverted

const newCategory = ref("");
const categories = ref([]);

const myColor = ref(DEFAULT_FUND_COLOR);
const groupIcon = ref(DEFAULT_FUND_ICON);

const removeMemberTarget = ref(null);
const removeCategoryTarget = ref(null); // { id, name, ... } category being removed
const transferOwnershipTarget = ref(null); // { id, name }
const showLeaveConfirm = ref(false);
const showDeleteConfirm = ref(false);

const affectedTransactionCount = computed(() => {
  if (!removeCategoryTarget.value) return 0;
  return transactionsStore.transactions.filter(
    (t) => t.type === "expense" && t.category === removeCategoryTarget.value.name,
  ).length;
});

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
      name.value = props.group.name || "";
      editingName.value = false;
      currency.value = props.group.currency;
      mode.value = props.group.mode || "kitty";
      myColor.value =
        props.group.members?.[authStore.user?.uid]?.color ||
        DEFAULT_FUND_COLOR;
      groupIcon.value = props.group.icon || DEFAULT_FUND_ICON;
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

function startEditingName() {
  if (!isOwner.value) return;
  name.value = props.group?.name || "";
  editingName.value = true;
  nextTick(() => nameInputRef.value?.focus());
}

function cancelEditingName() {
  name.value = props.group?.name || "";
  editingName.value = false;
}

async function saveName() {
  if (!props.group?.id) return;
  const trimmed = name.value.trim();
  if (!trimmed || trimmed === props.group.name) {
    editingName.value = false;
    return;
  }
  savingName.value = true;
  try {
    await groupsStore.updateName(props.group.id, trimmed);
    await groupsStore.loadGroup(props.group.id);
    editingName.value = false;
  } finally {
    savingName.value = false;
  }
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
    // Re-categorize affected transactions to "Other" first, so they're
    // never left pointing at a category name that no longer exists.
    await transactionsStore.reassignCategory(
      props.group.id,
      removeCategoryTarget.value.name,
      "Other",
    );
    await groupsStore.removeCategory(
      props.group.id,
      removeCategoryTarget.value.id,
    );
    await loadCategories();
    removeCategoryTarget.value = null;
  } finally {
    loading.value = false;
  }
}

async function handleAddPlaceholderMember(memberName) {
  if (!props.group?.id || !memberName) return;
  loading.value = true;
  try {
    await groupsStore.addPlaceholderMember(props.group.id, memberName);
    await groupsStore.loadGroup(props.group.id);
  } finally {
    loading.value = false;
  }
}

async function confirmRemoveMember() {
  if (!props.group?.id || !removeMemberTarget.value) return;
  loading.value = true;
  try {
    await groupsStore.removeMember(props.group.id, removeMemberTarget.value);
    await groupsStore.loadGroup(props.group.id);
    removeMemberTarget.value = null;
  } finally {
    loading.value = false;
  }
}

async function confirmLeaveGroup() {
  if (!props.group?.id) return;
  loading.value = true;
  try {
    await groupsStore.leaveGroup(props.group.id);
    emit("update:modelValue", false);
    router.push({ name: "dashboard" });
  } finally {
    loading.value = false;
    showLeaveConfirm.value = false;
  }
}

async function confirmDeleteGroup() {
  if (!props.group?.id || !isOwner.value) return;
  loading.value = true;
  try {
    await groupsStore.deleteGroup(props.group.id);
    emit("update:modelValue", false);
    router.push({ name: "dashboard" });
  } finally {
    loading.value = false;
    showDeleteConfirm.value = false;
  }
}

async function confirmTransferOwnership() {
  if (!props.group?.id || !transferOwnershipTarget.value || !isOwner.value) return;
  loading.value = true;
  try {
    await groupsStore.transferOwnership(props.group.id, transferOwnershipTarget.value.id);
    await groupsStore.loadGroup(props.group.id);
    transferOwnershipTarget.value = null;
  } finally {
    loading.value = false;
  }
}

async function handleSetColor(color) {
  if (!props.group?.id) return;
  myColor.value = color;
  await groupsStore.setMyColor(props.group.id, color);
  await groupsStore.loadGroup(props.group.id);
}

async function handleSetIcon(icon) {
  if (!props.group?.id || !isOwner.value) return;
  groupIcon.value = icon;
  await groupsStore.setGroupIcon(props.group.id, icon);
  await groupsStore.loadGroup(props.group.id);
}

const inviteUrl = computed(() => {
  if (!props.group?.id) return "";
  return `${getAppBaseUrl()}/join/${props.group.id}`;
});

const qrInviteUrl = computed(() => {
  if (!props.group?.id) return "";
  return `${getAppBaseUrl()}/join/${props.group.id}?qr=1`;
});

function copyInviteLink() {
  if (!props.group?.id) return;
  navigator.clipboard.writeText(inviteUrl.value);
}
</script>

<template>
  <div
    v-if="props.modelValue"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
  >
    <div
      class="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      @click="!loading && emit('update:modelValue', false)"
    />
    <div
      class="relative bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-none sm:max-w-[500px] max-h-[90vh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pb-6"
    >
      <!-- Mobile drag handle indicator -->
      <div class="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

      <h2 class="text-lg font-semibold font-display mb-4 dark:text-white">
        {{ $t('fundSettings.title') }}
      </h2>

      <div class="mb-4">
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >{{ $t('fundSettings.fundName') }}</label
        >
        <div v-if="editingName" class="flex items-center gap-2">
          <input
            ref="nameInputRef"
            v-model="name"
            type="text"
            maxlength="60"
            :disabled="savingName"
            @keyup.enter="saveName"
            @keyup.escape="cancelEditingName"
            class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent disabled:opacity-50 dark:bg-gray-700 dark:text-white"
          />
          <button
            @click="saveName"
            :disabled="savingName || !name.trim()"
            class="px-3 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i v-if="savingName" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-check"></i>
          </button>
          <button
            @click="cancelEditingName"
            :disabled="savingName"
            class="px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div v-else class="flex items-center gap-2">
          <span class="flex-1 px-3 py-2 dark:text-white truncate">{{
            props.group?.name
          }}</span>
          <button
            v-if="isOwner"
            @click="startEditingName"
            class="text-gray-400 hover:text-[#C8A5FC] dark:hover:text-[#C8A5FC] transition-colors p-2"
            :title="$t('fundSettings.renameFund')"
          >
            <i class="fas fa-pen"></i>
          </button>
        </div>
        <p
          v-if="!isOwner"
          class="text-xs text-gray-500 dark:text-gray-400 mt-1"
        >
          {{ $t('fundSettings.ownerOnlyName') }}
        </p>
      </div>

      <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto no-scrollbar -mx-1 px-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap',
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
        :qr-invite-url="qrInviteUrl"
        @copy-invite="copyInviteLink"
        @add-placeholder-member="handleAddPlaceholderMember"
        @remove="(id) => (removeMemberTarget = id)"
        @transfer-ownership="(target) => (transferOwnershipTarget = target)"
        @leave="showLeaveConfirm = true"
        @delete-fund="showDeleteConfirm = true"
      />

      <CategoriesTab
        v-if="activeTab === 'categories'"
        v-model:new-category="newCategory"
        :categories="categories"
        :is-owner="isOwner"
        :loading="loading"
        @add="handleAddCategory"
        @remove="(category) => (removeCategoryTarget = category)"
      />

      <StyleTab
        v-if="activeTab === 'style'"
        :color="myColor"
        :icon="groupIcon"
        :is-owner="isOwner"
        :loading="loading"
        @set-color="handleSetColor"
        @set-icon="handleSetIcon"
      />

      <div v-if="activeTab !== 'currency'" class="flex justify-end mt-6">
        <button
          @click="emit('update:modelValue', false)"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
        >
          <i class="fas fa-times"></i>
          {{ $t('common.close') }}
        </button>
      </div>
    </div>

    <ConfirmDialog
      :model-value="!!removeMemberTarget"
      @update:model-value="removeMemberTarget = null"
      :title="$t('fundSettings.removeMemberTitle')"
      :confirm-label="$t('common.remove')"
      danger
      :loading="loading"
      @confirm="confirmRemoveMember"
    >
      {{ $t('fundSettings.removeMemberConfirm') }}
    </ConfirmDialog>

    <ConfirmDialog
      :model-value="showLeaveConfirm"
      @update:model-value="showLeaveConfirm = false"
      :title="$t('fundSettings.leaveFundTitle')"
      :confirm-label="$t('common.leave')"
      danger
      :loading="loading"
      @confirm="confirmLeaveGroup"
    >
      {{ $t('fundSettings.leaveFundConfirm') }}
    </ConfirmDialog>

    <ConfirmDialog
      :model-value="showDeleteConfirm"
      @update:model-value="showDeleteConfirm = false"
      :title="$t('fundSettings.deleteFundTitle')"
      :confirm-label="$t('common.delete')"
      danger
      :loading="loading"
      @confirm="confirmDeleteGroup"
    >
      {{ $t('fundSettings.deleteFundConfirm') }}
    </ConfirmDialog>

    <ConfirmDialog
      :model-value="!!transferOwnershipTarget"
      @update:model-value="transferOwnershipTarget = null"
      :title="$t('fundSettings.transferOwnershipTitle')"
      :confirm-label="$t('common.confirm')"
      :loading="loading"
      @confirm="confirmTransferOwnership"
    >
      {{ $t('fundSettings.transferOwnershipConfirm', { name: transferOwnershipTarget?.name }) }}
    </ConfirmDialog>

    <ConfirmDialog
      :model-value="!!removeCategoryTarget"
      @update:model-value="removeCategoryTarget = null"
      :title="$t('fundSettings.removeCategoryTitle')"
      :confirm-label="$t('common.remove')"
      danger
      :loading="loading"
      @confirm="confirmRemoveCategory"
    >
      {{
        affectedTransactionCount > 0
          ? $t('fundSettings.removeCategoryConfirmWithCount', { count: affectedTransactionCount })
          : $t('fundSettings.removeCategoryConfirm')
      }}
    </ConfirmDialog>
  </div>
</template>
