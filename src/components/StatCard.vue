<script setup>
import { computed } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  currency: { type: String, default: "" },
  color: { type: String, default: "primary" },
  icon: { type: String, default: "cash" },
});

const colorClass = computed(() => {
  const colorMap = {
    primary: "text-[#C8A5FC]",
    success: "text-[#A7F49D]",
    error: "text-[#C1503A]",
    info: "text-[#A5E3FC]",
    warning: "text-[#D89B3C]",
  };
  return colorMap[props.color] || "text-[#C8A5FC]";
});

const labelClass = computed(() => {
  return "text-sm text-gray-600 dark:text-gray-400";
});
</script>

<template>
  <div
    class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
  >
    <div class="flex items-center justify-between mb-1">
      <span :class="labelClass">{{ label }}</span>
      <svg
        class="w-5 h-5 text-gray-500 dark:text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
    <div class="text-xl font-bold money dark:text-white" :class="colorClass">
      {{ value.toFixed(2) }} {{ currency }}
    </div>
  </div>
</template>
