<script setup>
import FundCard from "./FundCard.vue";

defineProps({
  groups: { type: Array, required: true },
  copiedId: { type: String, default: null },
});
defineEmits(["open", "copy-invite"]);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold font-display dark:text-white">
        Your shared funds
      </h2>
      <span class="text-sm text-gray-500 dark:text-gray-400"
        >{{ groups.length }} fund{{ groups.length !== 1 ? "s" : "" }}</span
      >
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FundCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
        :copied="copiedId === group.id"
        @open="$emit('open', group.id)"
        @copy-invite="$emit('copy-invite', group.id)"
      />
    </div>
  </div>
</template>
