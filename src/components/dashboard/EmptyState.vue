<script setup>
defineEmits(["create"]);
</script>

<template>
  <div
    class="bg-gradient-to-r from-[#A5E3FC]/20 to-[#C8A5FC]/20 border border-[#A5E3FC]/50 rounded-lg p-8 mb-6 text-center"
  >
    <div class="max-w-md mx-auto">
      <div
        class="w-16 h-16 bg-[#A5E3FC]/30 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <i class="fas fa-coins w-8 h-8 text-[#A5E3FC]"></i>
      </div>
      <h2 class="text-xl font-semibold mb-2 dark:text-white">
        Start your shared fund journey
      </h2>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Create your first shared fund to track expenses with friends, family,
        or roommates.
      </p>
      <button
        @click="$emit('create')"
        class="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors"
      >
        Create your first fund
      </button>
    </div>
  </div>
</template>
