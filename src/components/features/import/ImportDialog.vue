<script setup>
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useGroupsStore } from "@/stores/groups";
import { useTransactionsStore } from "@/stores/transactions";
import { useAuthStore } from "@/stores/auth";
import { CURRENCIES } from "@/constants/currencies";
import { parseImportFile, generateDefaultMemberMapping } from "@/utils/importData";
import { formatCompactNumber } from "@/utils/format";
import { getCategoryIcon } from "@/constants/categories";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // If opened from inside a group
  groupId: { type: String, default: null },
  group: { type: Object, default: () => null },
  members: { type: Object, default: () => ({}) },
  mode: { type: String, default: "split" },
});

const emit = defineEmits(["update:modelValue", "imported"]);

const router = useRouter();
const groupsStore = useGroupsStore();
const transactionsStore = useTransactionsStore();
const authStore = useAuthStore();

// Flow state
const currentStep = ref(1); // 1: Upload, 2: Target & Settings, 3: Member Mapping, 4: Preview, 5: Done
const isDragging = ref(false);
const isProcessing = ref(false);
const errorMessage = ref("");

// Parsed file data
const rawFileContent = ref("");
const fileName = ref("");
const parsedResult = ref(null);

// Import configuration
const targetType = ref(props.groupId ? "existing" : "new"); // 'new' | 'existing'
const selectedExistingGroupId = ref(props.groupId || "");
const newFundName = ref("");
const newFundCurrency = ref("USD");
const newFundMode = ref("split"); // 'split' | 'kitty'

// Member mapping
const currentUserSource = ref(""); // for 'new' fund mode
const existingMemberMap = ref({}); // sourceName -> uid or '__new__' for 'existing' fund mode

// Progress
const importProgress = ref({ done: 0, total: 0 });
const createdGroupId = ref(null);

// Preview table filter
const previewFilter = ref("all"); // 'all' | 'expense' | 'settlement'
const previewSearch = ref("");

// Reset when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      currentStep.value = 1;
      rawFileContent.value = "";
      fileName.value = "";
      parsedResult.value = null;
      errorMessage.value = "";
      createdGroupId.value = null;
      targetType.value = props.groupId ? "existing" : "new";
      selectedExistingGroupId.value = props.groupId || (groupsStore.groups[0]?.id || "");
    }
  },
);

const availableGroups = computed(() => groupsStore.groups || []);

const effectiveTargetGroup = computed(() => {
  if (targetType.value === "existing") {
    if (props.groupId && props.group) return props.group;
    return availableGroups.value.find((g) => g.id === selectedExistingGroupId.value) || null;
  }
  return null;
});

const effectiveMembers = computed(() => {
  if (targetType.value === "existing" && effectiveTargetGroup.value) {
    return effectiveTargetGroup.value.members || props.members || {};
  }
  return {};
});

const filteredPreviewTransactions = computed(() => {
  if (!parsedResult.value?.transactions) return [];
  return parsedResult.value.transactions.filter((tx) => {
    if (previewFilter.value !== "all" && tx.type !== previewFilter.value) {
      return false;
    }
    if (previewSearch.value) {
      const q = previewSearch.value.toLowerCase();
      const descMatch = (tx.description || "").toLowerCase().includes(q);
      const catMatch = (tx.category || "").toLowerCase().includes(q);
      const payerMatch = (tx.paidByName || "").toLowerCase().includes(q);
      if (!descMatch && !catMatch && !payerMatch) return false;
    }
    return true;
  });
});

const stats = computed(() => {
  const txs = parsedResult.value?.transactions || [];
  const totalAmount = txs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const expenses = txs.filter((t) => t.type === "expense");
  const settlements = txs.filter((t) => t.type === "settlement");

  let minDate = "";
  let maxDate = "";
  if (txs.length > 0) {
    const dates = txs.map((t) => t.date).filter(Boolean).sort();
    if (dates.length > 0) {
      minDate = dates[0];
      maxDate = dates[dates.length - 1];
    }
  }

  return {
    count: txs.length,
    totalAmount,
    expenseCount: expenses.length,
    settlementCount: settlements.length,
    minDate,
    maxDate,
  };
});

function close() {
  emit("update:modelValue", false);
}

function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (file) processFile(file);
}

function handleDrop(event) {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) processFile(file);
}

async function processFile(file) {
  fileName.value = file.name;
  errorMessage.value = "";
  isProcessing.value = true;

  try {
    const text = await file.text();
    rawFileContent.value = text;
    const parsed = parseImportFile(text, file.name);

    if (!parsed.transactions || parsed.transactions.length === 0) {
      throw new Error("No valid transactions found in file.");
    }

    parsedResult.value = parsed;

    // Populate fund defaults
    newFundName.value = parsed.groupName || file.name.replace(/\.[^/.]+$/, "");
    newFundCurrency.value = parsed.defaultCurrency || "USD";
    newFundMode.value = parsed.mode || "split";

    // Setup initial member mapping
    if (parsed.members?.length > 0) {
      const myNickname = (authStore.userProfile?.nickname || authStore.user?.displayName || "").toLowerCase();
      // Try to find if user's name matches any member in file
      const foundMe = parsed.members.find(
        (m) => m.toLowerCase() === myNickname || myNickname.includes(m.toLowerCase()),
      );
      currentUserSource.value = foundMe || parsed.members[0] || "";

      // Existing group mapping
      const defaultMap = generateDefaultMemberMapping(parsed.members, effectiveMembers.value);
      const existingMapObj = {};
      parsed.members.forEach((m) => {
        existingMapObj[m] = defaultMap[m] || "__new__";
      });
      existingMemberMap.value = existingMapObj;
    }

    currentStep.value = 2;
  } catch (err) {
    console.error("Failed to parse import file:", err);
    errorMessage.value = err.message || "Failed to parse file. Please check format.";
  } finally {
    isProcessing.value = false;
  }
}

// When target group changes, update member mappings
watch(selectedExistingGroupId, () => {
  if (parsedResult.value?.members && effectiveMembers.value) {
    const defaultMap = generateDefaultMemberMapping(parsedResult.value.members, effectiveMembers.value);
    const existingMapObj = {};
    parsedResult.value.members.forEach((m) => {
      existingMapObj[m] = defaultMap[m] || "__new__";
    });
    existingMemberMap.value = existingMapObj;
  }
});

async function executeImport() {
  if (!parsedResult.value) return;
  isProcessing.value = true;
  errorMessage.value = "";
  importProgress.value = { done: 0, total: parsedResult.value.transactions.length };

  try {
    let targetGroupId = null;

    if (targetType.value === "new") {
      // 1. Create new fund with all placeholder members
      targetGroupId = await groupsStore.createGroupWithImportedData({
        name: newFundName.value.trim() || "Imported Fund",
        currency: newFundCurrency.value,
        mode: newFundMode.value,
        sourceMembers: parsedResult.value.members || [],
        currentUserSourceName: currentUserSource.value,
        transactions: parsedResult.value.transactions || [],
        customCategories: parsedResult.value.customCategories || [],
        onProgress: (done, total) => {
          importProgress.value = { done, total };
        },
      });
    } else {
      // 2. Import into existing fund
      targetGroupId = selectedExistingGroupId.value || props.groupId;
      if (!targetGroupId) throw new Error("No target fund selected.");

      const groupCurrency = effectiveTargetGroup.value?.currency || "USD";
      const finalMemberMap = {};

      // Create placeholder members for any member mapped to '__new__'
      for (const [sourceName, mappedId] of Object.entries(existingMemberMap.value)) {
        if (mappedId === "__new__") {
          const newPlaceholderId = await groupsStore.addPlaceholderMember(targetGroupId, sourceName);
          finalMemberMap[sourceName] = newPlaceholderId;
        } else if (mappedId) {
          finalMemberMap[sourceName] = mappedId;
        }
      }

      await transactionsStore.importTransactionsBatch(
        targetGroupId,
        groupCurrency,
        parsedResult.value.transactions || [],
        finalMemberMap,
        {
          onProgress: (done, total) => {
            importProgress.value = { done, total };
          },
        },
      );
    }

    createdGroupId.value = targetGroupId;
    currentStep.value = 5; // Success step
    emit("imported", targetGroupId);
  } catch (err) {
    console.error("Import failed:", err);
    errorMessage.value = err.message || "Failed to complete import. Please try again.";
  } finally {
    isProcessing.value = false;
  }
}

function handleDoneNavigation() {
  close();
  if (createdGroupId.value) {
    router.push({ name: "group", params: { id: createdGroupId.value } });
  }
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
  >
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      @click="currentStep !== 5 && !isProcessing ? close() : null"
    />

    <!-- Modal Content -->
    <div
      class="relative bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-none sm:max-w-[620px] max-h-[92vh] flex flex-col border-t sm:border border-gray-100 dark:border-gray-700 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:pb-5"
    >
      <!-- Mobile drag handle indicator -->
      <div class="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

      <!-- Modal Header -->
      <div class="flex items-center justify-between px-5 pt-3 sm:pt-5 pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center text-lg shadow-xs"
          >
            <i class="fas fa-file-import"></i>
          </div>
          <div>
            <h2 class="text-lg font-bold font-display dark:text-white leading-tight">
              {{ $t('import.title') }}
            </h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ $t('import.subtitle') }}
            </p>
          </div>
        </div>

        <button
          v-if="!isProcessing"
          @click="close"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <i class="fas fa-times text-sm"></i>
        </button>
      </div>

      <!-- Step Indicators (Steps 1 to 4) -->
      <div
        v-if="currentStep <= 4"
        class="px-5 py-2.5 bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 shrink-0 flex items-center justify-between text-xs"
      >
        <div class="flex items-center gap-1.5 sm:gap-2">
          <span
            class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]"
            :class="currentStep >= 1 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'"
          >1</span>
          <span :class="currentStep === 1 ? 'font-bold text-gray-800 dark:text-white' : 'text-gray-500'">
            {{ $t('import.stepUpload') }}
          </span>
          <i class="fas fa-chevron-right text-[10px] text-gray-400 mx-0.5"></i>

          <span
            class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]"
            :class="currentStep >= 2 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'"
          >2</span>
          <span :class="currentStep === 2 ? 'font-bold text-gray-800 dark:text-white' : 'text-gray-500'">
            {{ $t('import.stepTarget') }}
          </span>
          <i class="fas fa-chevron-right text-[10px] text-gray-400 mx-0.5"></i>

          <span
            class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]"
            :class="currentStep >= 3 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'"
          >3</span>
          <span :class="currentStep === 3 ? 'font-bold text-gray-800 dark:text-white' : 'text-gray-500'">
            {{ $t('import.stepMembers') }}
          </span>
          <i class="fas fa-chevron-right text-[10px] text-gray-400 mx-0.5"></i>

          <span
            class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]"
            :class="currentStep >= 4 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'"
          >4</span>
          <span :class="currentStep === 4 ? 'font-bold text-gray-800 dark:text-white' : 'text-gray-500'">
            {{ $t('import.stepPreview') }}
          </span>
        </div>

        <span v-if="parsedResult" class="hidden sm:inline-block px-2 py-0.5 rounded-md bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] font-semibold text-[11px]">
          {{ parsedResult.detection?.formatName }}
        </span>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="flex-1 overflow-y-auto p-5 space-y-5">
        <!-- Error Banner -->
        <div
          v-if="errorMessage"
          class="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-center gap-2"
        >
          <i class="fas fa-exclamation-circle text-base shrink-0"></i>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- ============================================================ -->
        <!-- STEP 1: Upload & Auto-Detect -->
        <!-- ============================================================ -->
        <div v-if="currentStep === 1" class="space-y-4">
          <!-- Dropzone -->
          <div
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
            class="border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer"
            :class="
              isDragging
                ? 'border-primary bg-primary/10 scale-[0.99]'
                : 'border-gray-300 dark:border-gray-700 hover:border-[#C8A5FC] dark:hover:border-[#C8A5FC] bg-gray-50/50 dark:bg-gray-800/30'
            "
            @click="$refs.fileInput.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".csv,.json,text/csv,application/json"
              class="hidden"
              @change="handleFileSelect"
            />

            <div class="w-14 h-14 rounded-2xl bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center mx-auto mb-3 text-2xl shadow-xs">
              <i v-if="isProcessing" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-cloud-arrow-up"></i>
            </div>

            <h3 class="text-base font-bold text-gray-800 dark:text-white mb-1">
              {{ $t('import.dropzoneTitle') }}
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
              {{ $t('import.dropzoneSubtitle') }}
            </p>

            <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-xs">
              <i class="fas fa-file text-[#C8A5FC]"></i>
              <span>{{ $t('common.selected') }}: .csv, .json</span>
            </div>
          </div>

          <!-- Format Compatibility Badges -->
          <div class="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              {{ $t('import.supportedFormats') }}
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div class="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                <i class="fas fa-file-csv text-[#3FA34D]"></i>
                <span class="font-medium text-gray-700 dark:text-gray-300">Splitwise CSV</span>
              </div>
              <div class="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                <i class="fas fa-file-csv text-[#5C7A99]"></i>
                <span class="font-medium text-gray-700 dark:text-gray-300">Splital CSV</span>
              </div>
              <div class="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs col-span-2 sm:col-span-1">
                <i class="fas fa-file-code text-[#C8A5FC]"></i>
                <span class="font-medium text-gray-700 dark:text-gray-300">Kasseo JSON / CSV</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- STEP 2: Target Selection & Fund Settings -->
        <!-- ============================================================ -->
        <div v-if="currentStep === 2" class="space-y-4">
          <!-- Detected Summary Card -->
          <div class="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <i class="fas fa-check-circle text-primary text-xl"></i>
              <div>
                <div class="text-xs font-bold text-gray-800 dark:text-white">
                  {{ fileName }}
                </div>
                <div class="text-[11px] text-gray-600 dark:text-gray-300">
                  {{ parsedResult?.detection?.formatName }} &bull; {{ $t('import.transactionsFound', { count: stats.count }) }} &bull; {{ $t('import.membersFound', { count: parsedResult?.members?.length || 0 }) }}
                </div>
              </div>
            </div>
            <button
              type="button"
              @click="currentStep = 1"
              class="text-xs text-primary hover:underline font-medium"
            >
              {{ $t('import.changeFile') }}
            </button>
          </div>

          <!-- Target Choice -->
          <div>
            <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
              {{ $t('import.targetFund') }}
            </label>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                @click="targetType = 'new'"
                class="p-3.5 rounded-xl border text-left transition-all"
                :class="
                  targetType === 'new'
                    ? 'border-[#C8A5FC] bg-[#C8A5FC]/10 ring-2 ring-[#C8A5FC]/30'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                "
              >
                <div class="flex items-center gap-2 mb-1">
                  <i class="fas fa-plus-circle text-base text-primary"></i>
                  <span class="font-bold text-sm dark:text-white">{{ $t('import.createNewFund') }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ $t('groups.newFundTitle') }}
                </p>
              </button>

              <button
                type="button"
                @click="targetType = 'existing'"
                :disabled="availableGroups.length === 0"
                class="p-3.5 rounded-xl border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                :class="
                  targetType === 'existing'
                    ? 'border-[#C8A5FC] bg-[#C8A5FC]/10 ring-2 ring-[#C8A5FC]/30'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                "
              >
                <div class="flex items-center gap-2 mb-1">
                  <i class="fas fa-folder-open text-base text-[#8A5FBF] dark:text-[#C8A5FC]"></i>
                  <span class="font-bold text-sm dark:text-white">{{ $t('import.importToExisting') }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ $t('dashboard.yourFunds') }}
                </p>
              </button>
            </div>
          </div>

          <!-- Option A: New Fund Configuration -->
          <div v-if="targetType === 'new'" class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 space-y-3.5">
            <div>
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {{ $t('import.fundName') }}
              </label>
              <input
                v-model="newFundName"
                type="text"
                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A5FC]"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {{ $t('import.fundCurrency') }}
                </label>
                <select
                  v-model="newFundCurrency"
                  class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A5FC]"
                >
                  <option v-for="curr in CURRENCIES" :key="curr" :value="curr">
                    {{ curr }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {{ $t('import.fundMode') }}
                </label>
                <select
                  v-model="newFundMode"
                  class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A5FC]"
                >
                  <option value="split">{{ $t('fundSettings.modeSplitLabel') }} (Splitwise / Splital)</option>
                  <option value="kitty">{{ $t('fundSettings.modeKittyLabel') }} (Shared Pot)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Option B: Existing Fund Selector -->
          <div v-else class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              {{ $t('import.selectTargetFund') }}
            </label>
            <select
              v-model="selectedExistingGroupId"
              class="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A5FC]"
            >
              <option v-for="g in availableGroups" :key="g.id" :value="g.id">
                {{ g.name }} ({{ g.currency }} - {{ g.mode === 'split' ? 'Split' : 'Kitty' }})
              </option>
            </select>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- STEP 3: Member Mapping -->
        <!-- ============================================================ -->
        <div v-if="currentStep === 3" class="space-y-4">
          <!-- Mapping Explanation -->
          <div class="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl text-xs text-blue-800 dark:text-blue-200">
            <template v-if="targetType === 'new'">
              {{ $t('import.memberMappingNewHelp') }}
            </template>
            <template v-else>
              {{ $t('import.memberMappingExistingHelp') }}
            </template>
          </div>

          <!-- New Fund: Choose Persona ("Who are you?") -->
          <div v-if="targetType === 'new'" class="space-y-2">
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              {{ $t('import.whoAreYou') }}
            </label>

            <div class="space-y-2">
              <label
                v-for="m in parsedResult?.members"
                :key="m"
                class="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all"
                :class="
                  currentUserSource === m
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                "
              >
                <div class="flex items-center gap-3">
                  <input
                    type="radio"
                    name="currentUserSource"
                    :value="m"
                    v-model="currentUserSource"
                    class="text-primary focus:ring-primary"
                  />
                  <div>
                    <span class="font-bold text-sm dark:text-white">{{ m }}</span>
                    <span
                      v-if="currentUserSource === m"
                      class="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-primary text-white font-medium"
                    >
                      {{ $t('common.you') }}
                    </span>
                  </div>
                </div>

                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {{ currentUserSource === m ? 'Owner & Me' : 'Placeholder Profile' }}
                </span>
              </label>
            </div>
          </div>

          <!-- Existing Fund: Map each file participant -->
          <div v-else class="space-y-3">
            <div
              v-for="srcName in parsedResult?.members"
              :key="srcName"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40"
            >
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-[#C8A5FC]/20 text-[#8A5FBF] dark:text-[#C8A5FC] flex items-center justify-center text-xs font-bold">
                  {{ srcName.charAt(0).toUpperCase() }}
                </div>
                <span class="font-semibold text-sm dark:text-white">{{ srcName }}</span>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400"><i class="fas fa-arrow-right"></i></span>
                <select
                  v-model="existingMemberMap[srcName]"
                  class="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#C8A5FC]"
                >
                  <option value="__new__">{{ $t('import.createNewPlaceholder') }}</option>
                  <option
                    v-for="(m, uid) in effectiveMembers"
                    :key="uid"
                    :value="uid"
                  >
                    {{ m.nickname || m.displayName || m.email || uid }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- STEP 4: Summary & Preview Table -->
        <!-- ============================================================ -->
        <div v-if="currentStep === 4" class="space-y-4">
          <!-- Quick Stats Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
              <div class="text-[11px] text-gray-500 dark:text-gray-400">{{ $t('common.total') }}</div>
              <div class="text-base font-bold dark:text-white">{{ stats.count }}</div>
            </div>

            <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
              <div class="text-[11px] text-gray-500 dark:text-gray-400">{{ $t('import.totalVolume') }}</div>
              <div class="text-base font-bold money dark:text-white">
                {{ formatCompactNumber(stats.totalAmount) }} {{ newFundCurrency }}
              </div>
            </div>

            <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
              <div class="text-[11px] text-gray-500 dark:text-gray-400">{{ $t('import.expenses') }}</div>
              <div class="text-base font-bold text-[#C1503A]">{{ stats.expenseCount }}</div>
            </div>

            <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
              <div class="text-[11px] text-gray-500 dark:text-gray-400">{{ $t('import.settlements') }}</div>
              <div class="text-base font-bold text-[#5C7A99] dark:text-[#A5E3FC]">{{ stats.settlementCount }}</div>
            </div>
          </div>

          <!-- Preview Search and Filters -->
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="previewFilter = 'all'"
                class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                :class="previewFilter === 'all' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'"
              >
                {{ $t('export.allTypes') }}
              </button>
              <button
                type="button"
                @click="previewFilter = 'expense'"
                class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                :class="previewFilter === 'expense' ? 'bg-[#C1503A] text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'"
              >
                {{ $t('transactions.expense') }}
              </button>
              <button
                type="button"
                @click="previewFilter = 'settlement'"
                class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                :class="previewFilter === 'settlement' ? 'bg-[#5C7A99] text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'"
              >
                {{ $t('transactions.settleUp') }}
              </button>
            </div>

            <input
              v-model="previewSearch"
              type="text"
              placeholder="Search..."
              class="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none"
            />
          </div>

          <!-- Scrollable Table -->
          <div class="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-gray-50 dark:bg-gray-800/80 sticky top-0 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                <tr>
                  <th class="p-2 font-semibold">Date</th>
                  <th class="p-2 font-semibold">Description</th>
                  <th class="p-2 font-semibold">Category</th>
                  <th class="p-2 font-semibold">Paid By</th>
                  <th class="p-2 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                <tr
                  v-for="(tx, idx) in filteredPreviewTransactions.slice(0, 50)"
                  :key="idx"
                  class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td class="p-2 text-gray-500 whitespace-nowrap">{{ tx.date }}</td>
                  <td class="p-2 font-medium dark:text-white truncate max-w-[140px]">{{ tx.description }}</td>
                  <td class="p-2 text-gray-600 dark:text-gray-300">
                    <span class="inline-flex items-center gap-1">
                      <i :class="getCategoryIcon(tx.category)" class="text-[10px] text-gray-400"></i>
                      <span>{{ tx.category }}</span>
                    </span>
                  </td>
                  <td class="p-2 text-gray-600 dark:text-gray-300 truncate max-w-[90px]">{{ tx.paidByName }}</td>
                  <td class="p-2 font-semibold text-right money whitespace-nowrap" :class="tx.type === 'settlement' ? 'text-[#5C7A99] dark:text-[#A5E3FC]' : 'text-gray-900 dark:text-white'">
                    {{ tx.amount.toFixed(2) }} {{ tx.currency }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="filteredPreviewTransactions.length > 50" class="text-[11px] text-center text-gray-400">
            Showing first 50 of {{ filteredPreviewTransactions.length }} items
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- STEP 5: Success & Completion -->
        <!-- ============================================================ -->
        <div v-if="currentStep === 5" class="py-8 text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-[#3FA34D]/20 text-[#3FA34D] flex items-center justify-center mx-auto text-3xl shadow-xs">
            <i class="fas fa-check"></i>
          </div>

          <div>
            <h3 class="text-xl font-bold text-gray-800 dark:text-white">
              {{ $t('import.importSuccessTitle') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ $t('import.importSuccessMessage', { count: stats.count }) }}
            </p>
          </div>

          <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 max-w-sm mx-auto text-xs space-y-1.5 text-left">
            <div class="flex justify-between">
              <span class="text-gray-500">Fund:</span>
              <span class="font-bold dark:text-white">{{ targetType === 'new' ? newFundName : effectiveTargetGroup?.name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Transactions:</span>
              <span class="font-bold dark:text-white">{{ stats.count }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Currency:</span>
              <span class="font-bold dark:text-white">{{ targetType === 'new' ? newFundCurrency : effectiveTargetGroup?.currency }}</span>
            </div>
          </div>
        </div>

        <!-- Progress Overlay during Active Import -->
        <div v-if="isProcessing && currentStep === 4" class="p-4 bg-primary/10 rounded-xl border border-primary/20 space-y-2">
          <div class="flex justify-between text-xs font-semibold text-gray-800 dark:text-white">
            <span>{{ $t('import.importProgress', { done: importProgress.done, total: importProgress.total }) }}</span>
            <span>{{ Math.round((importProgress.done / (importProgress.total || 1)) * 100) }}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
            <div
              class="bg-primary h-full transition-all duration-200"
              :style="{ width: `${(importProgress.done / (importProgress.total || 1)) * 100}%` }"
            />
          </div>
        </div>
      </div>

      <!-- Modal Footer (Actions) -->
      <div class="px-5 pt-3 border-t border-gray-100 dark:border-gray-800 shrink-0 flex items-center justify-between">
        <!-- Back Button -->
        <button
          v-if="currentStep > 1 && currentStep < 5 && !isProcessing"
          type="button"
          @click="currentStep--"
          class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <i class="fas fa-chevron-left text-xs"></i>
          <span>Back</span>
        </button>
        <div v-else></div>

        <!-- Next / Action Buttons -->
        <div class="flex items-center gap-2">
          <button
            v-if="currentStep < 5 && !isProcessing"
            type="button"
            @click="close"
            class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            {{ $t('common.cancel') }}
          </button>

          <!-- Step 2 -> 3 -->
          <button
            v-if="currentStep === 2"
            type="button"
            @click="currentStep = 3"
            class="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-dark transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>Next</span>
            <i class="fas fa-chevron-right text-xs"></i>
          </button>

          <!-- Step 3 -> 4 -->
          <button
            v-if="currentStep === 3"
            type="button"
            @click="currentStep = 4"
            class="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-dark transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>{{ $t('import.stepPreview') }}</span>
            <i class="fas fa-chevron-right text-xs"></i>
          </button>

          <!-- Step 4 Execute -->
          <button
            v-if="currentStep === 4"
            type="button"
            @click="executeImport"
            :disabled="isProcessing"
            class="px-5 py-2 rounded-lg text-sm font-semibold bg-[#C8A5FC] hover:bg-[#B38BF5] text-white transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i v-if="isProcessing" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-file-import"></i>
            <span>{{ isProcessing ? $t('import.importing') : $t('import.startImport', { count: stats.count }) }}</span>
          </button>

          <!-- Step 5 Go to Fund -->
          <button
            v-if="currentStep === 5"
            type="button"
            @click="handleDoneNavigation"
            class="px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-dark transition-all shadow-xs flex items-center gap-2"
          >
            <span>{{ $t('import.goToFund') }}</span>
            <i class="fas fa-arrow-right text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
