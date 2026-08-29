<script setup>
defineEmits(["create", "import"]);
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
        {{ $t('dashboard.emptyHeadline') }}
      </h2>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        {{ $t('dashboard.emptySubtitle') }}
      </p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          @click="$emit('create')"
          class="w-full sm:w-auto bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-xs"
        >
          {{ $t('dashboard.createFirstFund') }}
        </button>
        <button
          @click="$emit('import')"
          class="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-[#C8A5FC] text-[#8A5FBF] dark:text-[#C8A5FC] bg-white dark:bg-surface-dark hover:bg-[#C8A5FC]/10 transition-colors font-medium flex items-center justify-center gap-2 shadow-xs"
        >
          <i class="fas fa-file-import"></i>
          <span>{{ $t('import.quickImport') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
