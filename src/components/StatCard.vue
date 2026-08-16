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

const iconClass = computed(() => {
  const iconMap = {
    "cash": "fa-coins",
    "piggy-bank": "fa-piggy-bank",
    "arrow-down": "fa-arrow-down",
    "arrow-up": "fa-arrow-up",
  };
  return iconMap[props.icon] || "fa-coins";
});
</script>

<template>
  <div
    class="bg-white dark:bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
  >
    <div class="flex items-center justify-between mb-1">
      <span :class="labelClass">{{ label }}</span>
      <i :class="['fas', iconClass, 'w-5 h-5 text-gray-500 dark:text-gray-400']"></i>
    </div>
    <div class="text-xl font-bold money dark:text-white" :class="colorClass">
      {{ value.toFixed(2) }} {{ currency }}
    </div>
  </div>
</template>
