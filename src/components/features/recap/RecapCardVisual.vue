<script setup>
import { computed } from "vue";

const props = defineProps({
  type: {
    type: String,
    default: null, // 'donut' | 'sparkline' | 'avatar' | 'confetti' | 'sparkle'
  },
  data: { type: Object, default: () => ({}) },
});

const reduceMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- donut ----
const RING_RADIUS = 42;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const donutDashoffset = computed(() => {
  const pct = Math.max(0, Math.min(100, props.data?.percent ?? 0));
  return RING_CIRC * (1 - pct / 100);
});
const donutLegend = computed(() => (props.data?.segments || []).slice(0, 4));

// ---- sparkline ----
const sparkBars = computed(() => {
  const bars = props.data?.bars || [];
  const max = Math.max(1, ...bars.map((b) => b.amount || 0));
  return bars.map((b, i) => ({
    ...b,
    heightPct: Math.max(6, Math.round(((b.amount || 0) / max) * 100)),
    isHighlight: i === props.data?.highlightIndex,
  }));
});

// ---- avatar ----
const initials = computed(() => {
  const name = (props.data?.name || "").trim();
  if (!name) return "?";
  const parts = name.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
});

// ---- confetti / sparkle ----
const pieceCount = 22;
const confettiPieces = computed(() =>
  Array.from({ length: pieceCount }, (_, i) => ({
    id: i,
    left: Math.round(Math.random() * 100),
    delay: (Math.random() * 0.6).toFixed(2),
    duration: (2.2 + Math.random() * 1.4).toFixed(2),
    size: 6 + Math.round(Math.random() * 6),
    rotate: Math.round(Math.random() * 360),
    shape: Math.random() > 0.5 ? "50%" : "2px",
  })),
);
const sparklePieces = computed(() =>
  Array.from({ length: 14 }, (_, i) => ({
    id: i,
    left: Math.round(Math.random() * 100),
    top: Math.round(Math.random() * 100),
    delay: (Math.random() * 2).toFixed(2),
    duration: (1.6 + Math.random() * 1.6).toFixed(2),
    size: 3 + Math.round(Math.random() * 4),
  })),
);
</script>

<template>
  <!-- Donut ring showing top category's share of total spend -->
  <div v-if="type === 'donut'" class="flex flex-col items-center gap-3">
    <svg viewBox="0 0 100 100" class="w-28 h-28 -rotate-90">
      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="10" />
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke="white"
        stroke-width="10"
        stroke-linecap="round"
        :stroke-dasharray="RING_CIRC"
        :stroke-dashoffset="donutDashoffset"
        class="donut-ring"
      />
    </svg>
    <div v-if="donutLegend.length > 1" class="flex flex-wrap justify-center gap-x-3 gap-y-1 max-w-[220px]">
      <div
        v-for="(seg, i) in donutLegend"
        :key="seg.name"
        class="flex items-center gap-1.5 text-[11px] text-white/80"
      >
        <span
          class="w-1.5 h-1.5 rounded-full shrink-0"
          :style="{ background: i === 0 ? 'white' : 'rgba(255,255,255,0.5)' }"
        />
        {{ seg.label }}
      </div>
    </div>
  </div>

  <!-- Mini bar sparkline across recent months -->
  <div v-else-if="type === 'sparkline'" class="flex items-end justify-center gap-2 h-20 w-full max-w-[260px]">
    <div v-for="(bar, i) in sparkBars" :key="i" class="flex flex-col items-center gap-1.5 flex-1">
      <div class="w-full flex items-end h-14 rounded-full overflow-hidden bg-white/15">
        <div
          class="w-full rounded-full spark-bar"
          :class="bar.isHighlight ? 'bg-white' : 'bg-white/45'"
          :style="{ height: bar.heightPct + '%', animationDelay: i * 70 + 'ms' }"
        />
      </div>
      <span class="text-[10px] font-semibold" :class="bar.isHighlight ? 'text-white' : 'text-white/60'">
        {{ bar.label }}
      </span>
    </div>
  </div>

  <!-- Avatar initials circle -->
  <div v-else-if="type === 'avatar'" class="flex items-center justify-center">
    <div class="avatar-ring w-20 h-20 rounded-full flex items-center justify-center bg-white/20 border-2 border-white/60">
      <span class="text-2xl font-bold font-display text-white">{{ initials }}</span>
    </div>
  </div>

  <!-- Confetti burst (outro) -->
  <div v-else-if="type === 'confetti' && !reduceMotion" class="pointer-events-none absolute inset-0 overflow-hidden">
    <span
      v-for="p in confettiPieces"
      :key="p.id"
      class="confetti-piece absolute top-[-5%] bg-white"
      :style="{
        left: p.left + '%',
        width: p.size + 'px',
        height: p.size + 'px',
        borderRadius: p.shape,
        transform: `rotate(${p.rotate}deg)`,
        animationDelay: p.delay + 's',
        animationDuration: p.duration + 's',
      }"
    />
  </div>

  <!-- Twinkling sparkles (intro) -->
  <div v-else-if="type === 'sparkle' && !reduceMotion" class="pointer-events-none absolute inset-0 overflow-hidden">
    <span
      v-for="p in sparklePieces"
      :key="p.id"
      class="sparkle-piece absolute rounded-full bg-white"
      :style="{
        left: p.left + '%',
        top: p.top + '%',
        width: p.size + 'px',
        height: p.size + 'px',
        animationDelay: p.delay + 's',
        animationDuration: p.duration + 's',
      }"
    />
  </div>
</template>

<style scoped>
.donut-ring {
  transition: stroke-dashoffset 1.1s cubic-bezier(0.22, 0.68, 0, 1);
}

.spark-bar {
  animation: spark-grow 0.6s cubic-bezier(0.22, 0.68, 0, 1) both;
}
@keyframes spark-grow {
  from {
    height: 0%;
  }
}

.avatar-ring {
  animation: avatar-pop 0.5s cubic-bezier(0.22, 0.68, 0, 1) both;
  box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.35);
}
@keyframes avatar-pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}

.confetti-piece {
  animation-name: confetti-fall;
  animation-timing-function: cubic-bezier(0.3, 0.4, 0.6, 1);
  animation-fill-mode: forwards;
  opacity: 0.9;
}
@keyframes confetti-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0.9;
  }
  100% {
    transform: translateY(115vh) rotate(360deg);
    opacity: 0;
  }
}

.sparkle-piece {
  animation-name: sparkle-twinkle;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
}
@keyframes sparkle-twinkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .donut-ring,
  .spark-bar,
  .avatar-ring {
    animation: none !important;
    transition: none !important;
  }
}
</style>
