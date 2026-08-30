<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useTranslation } from "i18next-vue";
import {
  getRecapYears,
  getDefaultRecapPeriod,
  filterByRecapPeriod,
  buildRecapStats,
} from "@/utils/recapData";
import { getCategoryLabel } from "@/constants/categories";
import { formatCurrency } from "@/utils/format";
import { downloadRecapCardImage } from "@/utils/recapImage";
import AnimatedNumber from "./AnimatedNumber.vue";
import RecapCardVisual from "./RecapCardVisual.vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  fundName: { type: String, default: "" },
  currency: { type: String, default: "" },
  transactions: { type: Array, default: () => [] },
  members: { type: Object, default: () => ({}) },
  mode: { type: String, default: "kitty" }, // 'kitty' | 'split'
});
const emit = defineEmits(["update:modelValue"]);

const { t } = useTranslation();

const period = ref("all");
const index = ref(0);
const isSharing = ref(false);
const touchStartX = ref(null);
const touchStartY = ref(null);
const dragX = ref(0);
const isDragging = ref(false);
const transitionName = ref("slide-next");

const years = computed(() => getRecapYears(props.transactions));

function resetPeriod() {
  period.value = getDefaultRecapPeriod(props.transactions);
  index.value = 0;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetPeriod();
  },
);

const periodTransactions = computed(() =>
  filterByRecapPeriod(props.transactions, period.value),
);

const stats = computed(() =>
  buildRecapStats(periodTransactions.value, {
    mode: props.mode,
    members: props.members,
  }),
);

const periodLabel = computed(() =>
  period.value === "all" ? t("recap.allTime") : period.value,
);

const monthFormatter = computed(
  () => new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }),
);
const shortMonthFormatter = computed(
  () => new Intl.DateTimeFormat(undefined, { month: "short" }),
);

function money(amount) {
  return formatCurrency(Number((amount || 0).toFixed(2)), props.currency);
}

const GRADIENTS = [
  ["#8A5FBF", "#C8A5FC"],
  ["#C1503A", "#D89B3C"],
  ["#5C7A99", "#A5E3FC"],
  ["#7A6248", "#D89B3C"],
  ["#8A5FBF", "#5C7A99"],
  ["#C1503A", "#8A5FBF"],
  ["#5C7A99", "#7A6248"],
];

// Builds the ordered slide deck. Any stat without enough underlying data
// is simply skipped so the deck never shows an empty/broken card. Each
// card may also carry a `numeric` raw value (for the count-up animation)
// and a `visual` descriptor (for the mini donut/sparkline/avatar/confetti
// shown behind the text).
const cards = computed(() => {
  const s = stats.value;
  const deck = [];
  let g = 0;
  const nextGradient = () => GRADIENTS[g++ % GRADIENTS.length];

  deck.push({
    id: "intro",
    emoji: "\u2728",
    eyebrow: periodLabel.value,
    value: props.fundName,
    label: t("recap.introLabel"),
    subtitle: t("recap.introSubtitle", { count: s.transactionCount }),
    visual: { type: "sparkle" },
    ...zip(nextGradient()),
  });

  if (!s.hasData) {
    deck.push({
      id: "empty",
      emoji: "\uD83E\uDDFE",
      value: t("recap.noDataValue"),
      label: t("recap.noDataLabel"),
      ...zip(nextGradient()),
    });
    return deck;
  }

  if (s.totalSpent > 0) {
    deck.push({
      id: "totalSpent",
      emoji: "\uD83D\uDCB8",
      eyebrow: t("recap.totalSpentEyebrow"),
      value: money(s.totalSpent),
      numeric: s.totalSpent,
      label: t("recap.totalSpentLabel"),
      subtitle:
        s.mode === "kitty" && s.totalDeposited > 0
          ? t("recap.totalDepositedSubtitle", { amount: money(s.totalDeposited) })
          : "",
      ...zip(nextGradient()),
    });
  }

  if (s.topCategory) {
    deck.push({
      id: "topCategory",
      emoji: "\uD83C\uDFC6",
      eyebrow: t("recap.topCategoryEyebrow"),
      value: getCategoryLabel(s.topCategory.name, t),
      label: t("recap.topCategoryLabel", { amount: money(s.topCategory.amount) }),
      subtitle: t("recap.topCategorySubtitle", {
        percent: Math.round(s.topCategory.percent),
      }),
      visual: {
        type: "donut",
        data: {
          percent: s.topCategory.percent,
          segments: s.categoryBreakdown.map((c) => ({
            name: c.name,
            label: getCategoryLabel(c.name, t),
            percent: c.percent,
          })),
        },
      },
      ...zip(nextGradient()),
    });
  }

  if (s.biggestExpense) {
    deck.push({
      id: "biggestExpense",
      emoji: "\uD83D\uDD25",
      eyebrow: t("recap.biggestExpenseEyebrow"),
      value: money(s.biggestExpense.amount),
      numeric: s.biggestExpense.amount,
      label: s.biggestExpense.description || getCategoryLabel(s.biggestExpense.category, t),
      subtitle: s.biggestExpense.date
        ? new Date(s.biggestExpense.date).toLocaleDateString()
        : "",
      ...zip(nextGradient()),
    });
  }

  if (s.topMonth) {
    const bars = s.monthlyTrend.map((m) => ({
      label: shortMonthFormatter.value.format(m.date),
      amount: m.amount,
    }));
    const highlightIndex = s.monthlyTrend.findIndex(
      (m) =>
        m.date.getFullYear() === s.topMonth.date.getFullYear() &&
        m.date.getMonth() === s.topMonth.date.getMonth(),
    );
    deck.push({
      id: "topMonth",
      emoji: "\uD83D\uDCC5",
      eyebrow: t("recap.topMonthEyebrow"),
      value: monthFormatter.value.format(s.topMonth.date),
      label: t("recap.topMonthLabel", { amount: money(s.topMonth.amount) }),
      visual: bars.length > 1 ? { type: "sparkline", data: { bars, highlightIndex } } : null,
      ...zip(nextGradient()),
    });
  }

  if (s.mode === "split" && s.topSpender) {
    deck.push({
      id: "topSpender",
      emoji: "\uD83D\uDC51",
      eyebrow: t("recap.topSpenderEyebrow"),
      value: s.topSpender.name || t("common.someone"),
      label: t("recap.topSpenderLabel", { amount: money(s.topSpender.amount) }),
      visual: { type: "avatar", data: { name: s.topSpender.name || t("common.someone") } },
      ...zip(nextGradient()),
    });
  } else if (s.mode === "kitty" && s.topDepositor) {
    deck.push({
      id: "topDepositor",
      emoji: "\uD83D\uDC51",
      eyebrow: t("recap.topDepositorEyebrow"),
      value: s.topDepositor.name || t("common.someone"),
      label: t("recap.topDepositorLabel", { amount: money(s.topDepositor.amount) }),
      visual: { type: "avatar", data: { name: s.topDepositor.name || t("common.someone") } },
      ...zip(nextGradient()),
    });
  }

  deck.push({
    id: "outro",
    emoji: "\uD83C\uDF89",
    eyebrow: periodLabel.value,
    value: t("recap.outroValue", { count: s.expenseCount }),
    label: t("recap.outroLabel"),
    subtitle: t("recap.outroSubtitle", { fund: props.fundName }),
    visual: { type: "confetti" },
    ...zip(nextGradient()),
  });

  return deck;
});

function zip([colorFrom, colorTo]) {
  return { colorFrom, colorTo };
}

const currentCard = computed(() => cards.value[index.value] || cards.value[0]);

// Two-layer crossfade so the background gradient never hard-cuts between
// cards — the incoming layer fades in on top of whichever is visible.
const bgLayerA = ref(null);
const bgLayerB = ref(null);
const activeLayer = ref("A");

function gradientStyle(card) {
  return { background: `linear-gradient(135deg, ${card.colorFrom}, ${card.colorTo})` };
}

watch(
  currentCard,
  (card) => {
    if (!card) return;
    const style = gradientStyle(card);
    if (!bgLayerA.value) {
      bgLayerA.value = style;
      activeLayer.value = "A";
      return;
    }
    if (activeLayer.value === "A") {
      bgLayerB.value = style;
      activeLayer.value = "B";
    } else {
      bgLayerA.value = style;
      activeLayer.value = "A";
    }
  },
  { immediate: true },
);

watch(cards, (deck) => {
  if (index.value >= deck.length) index.value = Math.max(0, deck.length - 1);
});

function goNext() {
  if (index.value < cards.value.length - 1) {
    transitionName.value = "slide-next";
    index.value++;
  }
}
function goPrev() {
  if (index.value > 0) {
    transitionName.value = "slide-prev";
    index.value--;
  }
}
function selectPeriod(p) {
  transitionName.value = "slide-next";
  period.value = p;
  index.value = 0;
}
function close() {
  emit("update:modelValue", false);
}

function onTouchStart(e) {
  touchStartX.value = e.touches[0].clientX;
  touchStartY.value = e.touches[0].clientY;
  isDragging.value = true;
}
function onTouchMove(e) {
  if (touchStartX.value === null) return;
  const dx = e.touches[0].clientX - touchStartX.value;
  const dy = e.touches[0].clientY - touchStartY.value;
  if (Math.abs(dy) > Math.abs(dx)) return;
  dragX.value = dx;
}
function onTouchEnd(e) {
  if (touchStartX.value === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX.value;
  const dy = e.changedTouches[0].clientY - touchStartY.value;
  touchStartX.value = null;
  touchStartY.value = null;
  isDragging.value = false;
  dragX.value = 0;
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
  if (dx < 0) goNext();
  else goPrev();
}

function onTapZone(zone) {
  if (zone === "prev") goPrev();
  else goNext();
}

function onKeydown(e) {
  if (!props.modelValue) return;
  if (e.key === "ArrowRight") goNext();
  else if (e.key === "ArrowLeft") goPrev();
  else if (e.key === "Escape") close();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

async function shareCurrentCard() {
  if (isSharing.value) return;
  isSharing.value = true;
  try {
    await downloadRecapCardImage(
      currentCard.value,
      { fundName: props.fundName, brand: "Kasseo" },
      `kasseo-recap-${currentCard.value.id}.png`,
    );
  } finally {
    isSharing.value = false;
  }
}
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-[60] flex items-center justify-center bg-black">
    <div class="relative w-full h-full sm:h-[92vh] sm:max-h-[850px] sm:w-[420px] sm:rounded-2xl overflow-hidden select-none">
      <!-- Crossfaded gradient background -->
      <div
        class="absolute inset-0 transition-opacity duration-500 ease-out"
        :class="activeLayer === 'A' ? 'opacity-100 z-[2]' : 'opacity-0 z-[1]'"
        :style="bgLayerA"
      />
      <div
        class="absolute inset-0 transition-opacity duration-500 ease-out"
        :class="activeLayer === 'B' ? 'opacity-100 z-[2]' : 'opacity-0 z-[1]'"
        :style="bgLayerB"
      />
      <div class="absolute inset-0 z-[2] bg-black/15"></div>
      <!-- Drifting decorative blobs -->
      <div class="absolute inset-0 z-[2] overflow-hidden pointer-events-none">
        <div class="blob blob-a"></div>
        <div class="blob blob-b"></div>
      </div>

      <!-- Progress segments -->
      <div class="absolute top-3 left-3 right-3 flex gap-1.5 z-20">
        <div
          v-for="(c, i) in cards"
          :key="c.id"
          class="h-1 flex-1 rounded-full bg-white/30 overflow-hidden"
        >
          <div
            class="h-full bg-white transition-all duration-500 ease-out"
            :style="{ width: i < index ? '100%' : i === index ? '100%' : '0%' }"
          />
        </div>
      </div>

      <!-- Header: period + close -->
      <div class="absolute top-8 left-3 right-3 z-20 flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            @click="selectPeriod('all')"
            class="px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors"
            :class="
              period === 'all'
                ? 'bg-white text-gray-900'
                : 'bg-white/20 text-white hover:bg-white/30'
            "
          >
            {{ $t('recap.allTime') }}
          </button>
          <button
            v-for="y in years"
            :key="y"
            type="button"
            @click="selectPeriod(String(y))"
            class="px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors"
            :class="
              period === String(y)
                ? 'bg-white text-gray-900'
                : 'bg-white/20 text-white hover:bg-white/30'
            "
          >
            {{ y }}
          </button>
        </div>
        <button
          type="button"
          @click="close"
          class="w-8 h-8 shrink-0 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
          :aria-label="$t('recap.close')"
        >
          <i class="fas fa-times text-sm"></i>
        </button>
      </div>

      <!-- Tap zones for prev/next -->
      <button
        type="button"
        class="absolute inset-y-0 left-0 w-1/3 z-10"
        :aria-label="$t('common.previous', { defaultValue: 'Previous' })"
        @click="onTapZone('prev')"
      />
      <button
        type="button"
        class="absolute inset-y-0 right-0 w-2/3 z-10"
        :aria-label="$t('common.next', { defaultValue: 'Next' })"
        @click="onTapZone('next')"
      />

      <!-- Card content -->
      <div
        class="absolute inset-0 z-10 overflow-hidden"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      >
        <Transition :name="transitionName" mode="out-in">
          <div
            :key="currentCard?.id"
            class="absolute inset-0 flex flex-col items-center justify-center text-center px-8 py-24"
            :style="isDragging ? { transform: `translateX(${dragX * 0.4}px)`, transition: 'none' } : {}"
          >
            <RecapCardVisual
              v-if="currentCard?.visual?.type === 'confetti' || currentCard?.visual?.type === 'sparkle'"
              :type="currentCard.visual.type"
              :data="currentCard.visual.data"
            />

            <div v-if="currentCard?.emoji" class="entrance text-6xl mb-4" style="animation-delay: 0ms">
              {{ currentCard.emoji }}
            </div>
            <div
              v-if="currentCard?.eyebrow"
              class="entrance text-white/80 text-xs font-bold tracking-widest uppercase mb-3"
              style="animation-delay: 70ms"
            >
              {{ currentCard.eyebrow }}
            </div>
            <div
              class="entrance text-white text-4xl font-extrabold font-display leading-tight break-words"
              style="animation-delay: 140ms"
            >
              <AnimatedNumber v-if="currentCard?.numeric != null" :target="currentCard.numeric" :formatter="money" />
              <template v-else>{{ currentCard?.value }}</template>
            </div>
            <div
              v-if="currentCard?.label"
              class="entrance text-white/90 text-lg font-semibold mt-3"
              style="animation-delay: 210ms"
            >
              {{ currentCard.label }}
            </div>
            <div
              v-if="currentCard?.subtitle"
              class="entrance text-white/75 text-sm mt-2"
              style="animation-delay: 280ms"
            >
              {{ currentCard.subtitle }}
            </div>

            <div
              v-if="currentCard?.visual && !['confetti', 'sparkle'].includes(currentCard.visual.type)"
              class="entrance mt-6"
              style="animation-delay: 320ms"
            >
              <RecapCardVisual :type="currentCard.visual.type" :data="currentCard.visual.data" />
            </div>
          </div>
        </Transition>
      </div>

      <!-- Footer actions -->
      <div class="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-3 px-6">
        <button
          type="button"
          @click="shareCurrentCard"
          :disabled="isSharing"
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-gray-900 text-sm font-semibold shadow-lg active:scale-95 transition-all disabled:opacity-60"
        >
          <i class="fas fa-download text-xs"></i>
          {{ isSharing ? $t('recap.sharing') : $t('recap.share') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Slide transitions between cards */
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: transform 360ms cubic-bezier(0.22, 0.68, 0, 1), opacity 280ms ease;
}
.slide-next-enter-from {
  transform: translateX(36px) scale(0.98);
  opacity: 0;
}
.slide-next-leave-to {
  transform: translateX(-36px) scale(0.98);
  opacity: 0;
}
.slide-prev-enter-from {
  transform: translateX(-36px) scale(0.98);
  opacity: 0;
}
.slide-prev-leave-to {
  transform: translateX(36px) scale(0.98);
  opacity: 0;
}

/* Staggered entrance for the text elements inside a card */
.entrance {
  animation: entrance-in 0.55s cubic-bezier(0.22, 0.68, 0, 1) both;
}
@keyframes entrance-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Slowly drifting decorative blobs */
.blob {
  position: absolute;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  filter: blur(2px);
}
.blob-a {
  width: 260px;
  height: 260px;
  top: -8%;
  right: -12%;
  animation: drift-a 14s ease-in-out infinite;
}
.blob-b {
  width: 320px;
  height: 320px;
  bottom: -14%;
  left: -14%;
  animation: drift-b 18s ease-in-out infinite;
}
@keyframes drift-a {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(-18px, 22px) scale(1.08);
  }
}
@keyframes drift-b {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(20px, -16px) scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .slide-next-enter-active,
  .slide-next-leave-active,
  .slide-prev-enter-active,
  .slide-prev-leave-active,
  .entrance,
  .blob-a,
  .blob-b {
    animation: none !important;
    transition: none !important;
  }
  .slide-next-enter-from,
  .slide-next-leave-to,
  .slide-prev-enter-from,
  .slide-prev-leave-to {
    transform: none !important;
    opacity: 1 !important;
  }
}
</style>
