<script setup>
import { ref, computed, watch } from "vue";
import { ref as dbRef, onValue, get, runTransaction, set } from "firebase/database";
import { db } from "@/services/firebase/config";
import { useTransactionsStore } from "@/stores/transactions";
import { CATEGORIES, getCategoryIcon } from "@/constants/categories";
import { scanReceiptImage, ScanError } from "@/utils/receiptScan";

const props = defineProps({
  modelValue: Boolean,
  groupId: { type: String, required: true },
  groupCurrency: { type: String, required: true },
  customCategories: { type: Array, default: () => [] },
  mode: { type: String, default: "kitty" }, // 'kitty' | 'split'
  members: { type: Object, default: () => ({}) },
  currentUserId: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

function itemCategoryIcon(catName) {
  const customCat = props.customCategories.find((c) => c.name === catName);
  return getCategoryIcon(catName, customCat?.icon);
}

const transactionsStore = useTransactionsStore();

const DAILY_SCAN_LIMIT = 5;

// step: 'capture' -> 'preview' -> 'processing' -> 'review' -> 'error'
const step = ref("capture");
const errorMessage = ref("");
const fileInput = ref(null);
const previewUrl = ref(null);
const compressedBase64 = ref(null); // no "data:...;base64," prefix
const items = ref([]); // [{ name, quantity, unitPrice, totalPrice, category, _aiCategory, splitAmong }]
const date = ref(new Date().toISOString().slice(0, 10));
const saving = ref(false);
const scansUsedToday = ref(0);
const splitOption = ref("whole_group"); // 'whole_group' | 'per_item'

const memberEntries = computed(() =>
  Object.entries(props.members || {}).map(([id, m]) => ({ id, ...m })),
);

const allCategories = computed(() => {
  const customNames = props.customCategories.map((cat) => cat.name);
  const defaultCategories = CATEGORIES.filter(
    (cat) => !customNames.includes(cat),
  );
  return [...customNames, ...defaultCategories];
});

const scansRemaining = computed(() =>
  Math.max(0, DAILY_SCAN_LIMIT - scansUsedToday.value),
);

const total = computed(() =>
  items.value.reduce((sum, it) => sum + (Number(it.totalPrice) || 0), 0),
);

let stopLimitListener = null;

function budapestDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// RTDB keys can't contain . # $ [ ] /
function sanitizeKey(str) {
  return str.replace(/[.#$[\]/]/g, "_");
}

// Atomically claims one of today's scan slots for this fund. A soft
// limit (also enforced in database.rules.json) since there's no backend.
async function reserveScanSlot() {
  const limitRef = dbRef(db, `scanLimits/${props.groupId}/${budapestDateKey()}`);
  const result = await runTransaction(limitRef, (current) => {
    const count = current?.count || 0;
    if (count >= DAILY_SCAN_LIMIT) return; // abort, don't touch it
    return { count: count + 1, updatedAt: Date.now() };
  });
  if (!result.committed) {
    throw new ScanError(
      "You've reached today's limit of 3 receipt scans for this fund.",
      "resource-exhausted",
    );
  }
}

function listenToScanLimit() {
  if (stopLimitListener) stopLimitListener();
  const limitRef = dbRef(
    db,
    `scanLimits/${props.groupId}/${budapestDateKey()}`,
  );
  stopLimitListener = onValue(limitRef, (snap) => {
    scansUsedToday.value = snap.val()?.count || 0;
  });
}

function reset() {
  step.value = "capture";
  errorMessage.value = "";
  previewUrl.value = null;
  compressedBase64.value = null;
  items.value = [];
  splitOption.value = "whole_group";
  date.value = new Date().toISOString().slice(0, 10);
  if (fileInput.value) fileInput.value.value = "";
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      reset();
      listenToScanLimit();
    } else if (stopLimitListener) {
      stopLimitListener();
      stopLimitListener = null;
    }
  },
);

function close() {
  emit("update:modelValue", false);
}

// Downscale + compress the photo client-side before it goes anywhere.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      img.onerror = () => reject(new Error("decode-failed"));
      img.onload = () => {
        const maxWidth = 1500;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await compressImage(file);
    previewUrl.value = dataUrl;
    compressedBase64.value = dataUrl.split(",")[1] || "";
    step.value = "preview";
  } catch (err) {
    errorMessage.value = "Couldn't read that image — try another photo.";
    step.value = "error";
  }
}

async function submitScan() {
  if (!compressedBase64.value) return;
  step.value = "processing";
  errorMessage.value = "";
  try {
    await reserveScanSlot();

    const overridesSnap = await get(
      dbRef(db, `categoryOverrides/${props.groupId}`),
    );
    const overrides = overridesSnap.exists() ? overridesSnap.val() : {};

    const scanned = await scanReceiptImage(
      compressedBase64.value,
      allCategories.value,
      overrides,
    );

    if (!scanned.length) {
      errorMessage.value =
        "No items were recognized on that receipt. Try a clearer, well-lit photo.";
      step.value = "error";
      return;
    }
    const allMemberIds = Object.keys(props.members || {});
    items.value = scanned.map((it) => ({
      ...it,
      _aiCategory: it.category,
      splitAmong: [...allMemberIds],
    }));
    step.value = "review";
  } catch (err) {
    errorMessage.value =
      err instanceof ScanError
        ? err.message
        : "Something went wrong scanning that receipt. Please try again.";
    step.value = "error";
  }
}

function removeItem(index) {
  items.value.splice(index, 1);
}

function toggleItemMember(item, memberId) {
  if (!Array.isArray(item.splitAmong)) {
    item.splitAmong = Object.keys(props.members || {});
  }
  if (item.splitAmong.includes(memberId)) {
    if (item.splitAmong.length === 1) return; // Keep at least one member
    item.splitAmong = item.splitAmong.filter((id) => id !== memberId);
  } else {
    item.splitAmong = [...item.splitAmong, memberId];
  }
}

function itemPerShare(item) {
  const count =
    item.splitAmong?.length || Object.keys(props.members || {}).length || 1;
  const price = Number(item.totalPrice) || 0;
  return (price / count).toFixed(2);
}

const canSave = computed(() => {
  if (!items.value.length || saving.value) return false;
  if (props.mode === "split" && splitOption.value === "per_item") {
    return items.value.every(
      (it) => Array.isArray(it.splitAmong) && it.splitAmong.length > 0,
    );
  }
  return true;
});

async function persistCategoryOverridesIfNeeded() {
  const changed = items.value.filter(
    (it) => it.category && it.category !== it._aiCategory,
  );
  if (!changed.length) return;
  await Promise.allSettled(
    changed.map((it) => {
      const key = sanitizeKey(it.name.trim().toLowerCase()).slice(0, 100);
      if (!key) return Promise.resolve();
      return set(
        dbRef(db, `categoryOverrides/${props.groupId}/${key}`),
        it.category,
      );
    }),
  );
}

async function approveAndSave() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const allMemberIds = Object.keys(props.members || {});
    const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    for (const it of items.value) {
      const label =
        it.quantity && it.quantity > 1 ? `${it.name} ×${it.quantity}` : it.name;
      const splitAmong =
        props.mode === "split"
          ? splitOption.value === "whole_group"
            ? allMemberIds
            : it.splitAmong?.length
              ? it.splitAmong
              : allMemberIds
          : undefined;

      await transactionsStore.addTransaction(props.groupId, props.groupCurrency, {
        amount: it.totalPrice,
        currency: props.groupCurrency,
        type: "expense",
        category: it.category,
        categoryIcon: itemCategoryIcon(it.category),
        description: label,
        date: date.value,
        splitAmong,
        receiptId,
        splitOption: props.mode === "split" ? splitOption.value : undefined,
      });
    }
    await persistCategoryOverridesIfNeeded();
    close();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="props.modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center"
  >
    <div class="absolute inset-0 bg-black/50" @click="close" />
    <div
      class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[480px] mx-4 max-h-[90vh] overflow-y-auto"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold font-display dark:text-white">
          Scan a receipt
        </h2>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- CAPTURE -->
      <div v-if="step === 'capture'">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Take a photo of a receipt and Kasseo will read the items and
          categorize them for you.
        </p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">
          {{ scansRemaining }}/{{ DAILY_SCAN_LIMIT }} scans left today for
          this fund
        </p>

        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="handleFileSelected"
        />
        <button
          @click="fileInput?.click()"
          :disabled="scansRemaining <= 0"
          class="w-full px-4 py-3 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <i class="fas fa-camera"></i>
          {{ scansRemaining > 0 ? "Take a photo" : "No scans left today" }}
        </button>
      </div>

      <!-- PREVIEW -->
      <div v-else-if="step === 'preview'">
        <img
          :src="previewUrl"
          alt="Receipt preview"
          class="w-full max-h-[320px] object-contain rounded-lg border border-gray-200 dark:border-gray-700 mb-4"
        />
        <div class="flex gap-2">
          <button
            @click="step = 'capture'"
            class="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Retake
          </button>
          <button
            @click="submitScan"
            class="flex-1 px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors"
          >
            Scan receipt
          </button>
        </div>
      </div>

      <!-- PROCESSING -->
      <div v-else-if="step === 'processing'" class="py-10 text-center">
        <i class="fas fa-spinner fa-spin text-3xl text-[#C8A5FC] mb-3"></i>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Reading the receipt…
        </p>
      </div>

      <!-- ERROR -->
      <div v-else-if="step === 'error'">
        <p class="text-sm text-red-500 mb-4">{{ errorMessage }}</p>
        <button
          @click="step = 'capture'"
          class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Try again
        </button>
      </div>

      <!-- REVIEW -->
      <div v-else-if="step === 'review'">
        <p class="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Check the items below before adding them — you can edit or remove
          anything that wasn't read correctly.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date
            </label>
            <input
              v-model="date"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>

          <div v-if="props.mode === 'split'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Split method
            </label>
            <div class="flex text-xs rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 h-[38px] p-0.5 bg-gray-50 dark:bg-gray-700">
              <button
                type="button"
                @click="splitOption = 'whole_group'"
                class="flex-1 px-2 rounded-md transition-colors font-medium flex items-center justify-center gap-1"
                :class="
                  splitOption === 'whole_group'
                    ? 'bg-[#C8A5FC] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                "
              >
                <i class="fas fa-users text-xs"></i>
                Whole group
              </button>
              <button
                type="button"
                @click="splitOption = 'per_item'"
                class="flex-1 px-2 rounded-md transition-colors font-medium flex items-center justify-center gap-1"
                :class="
                  splitOption === 'per_item'
                    ? 'bg-[#C8A5FC] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                "
              >
                <i class="fas fa-[#C8A5FC] fa-list-check text-xs"></i>
                Per product
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
          <div
            v-for="(item, index) in items"
            :key="index"
            class="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
          >
            <div class="flex items-start gap-2 mb-2">
              <input
                v-model="item.name"
                type="text"
                class="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] dark:bg-gray-700 dark:text-white"
              />
              <button
                @click="removeItem(index)"
                class="text-gray-400 hover:text-red-500 shrink-0 px-1"
                title="Remove item"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Qty
                </label>
                <input
                  v-model.number="item.quantity"
                  type="number"
                  min="1"
                  step="1"
                  class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Total price
                </label>
                <input
                  v-model.number="item.totalPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Category
              </label>
              <div class="relative flex items-center">
                <div class="absolute left-2.5 text-gray-500 dark:text-gray-400 text-xs pointer-events-none">
                  <i :class="itemCategoryIcon(item.category)"></i>
                </div>
                <select
                  v-model="item.category"
                  class="w-full pl-8 pr-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] dark:bg-gray-700 dark:text-white"
                >
                  <option v-for="cat in allCategories" :key="cat" :value="cat">
                    {{ cat }}
                  </option>
                </select>
              </div>
            </div>

            <div
              v-if="props.mode === 'split' && splitOption === 'per_item'"
              class="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700"
            >
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Split between
              </label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="m in memberEntries"
                  :key="m.id"
                  type="button"
                  @click="toggleItemMember(item, m.id)"
                  class="text-xs px-2.5 py-1 rounded-full border transition-colors"
                  :class="
                    (item.splitAmong || []).includes(m.id)
                      ? 'bg-[#C8A5FC] border-[#C8A5FC] text-white'
                      : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  "
                >
                  {{ m.id === currentUserId ? "You" : m.displayName }}
                </button>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                {{ itemPerShare(item) }} each (split between {{ (item.splitAmong || []).length }} {{ (item.splitAmong || []).length === 1 ? 'person' : 'people' }})
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between mt-4 mb-4 text-sm">
          <span class="text-gray-500 dark:text-gray-400">
            {{ items.length }} item{{ items.length === 1 ? "" : "s" }}
          </span>
          <span class="font-medium dark:text-white">Total: {{ total.toFixed(2) }}</span>
        </div>

        <button
          @click="approveAndSave"
          :disabled="!canSave"
          class="w-full px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <i v-if="saving" class="fas fa-spinner fa-spin"></i>
          Add {{ items.length }} transaction{{ items.length === 1 ? "" : "s" }}
        </button>
      </div>
    </div>
  </div>
</template>
