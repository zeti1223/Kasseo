<script setup>
defineProps({
  members: { type: Array, required: true },
  ownerId: { type: String, default: "" },
  currentUserId: { type: String, default: "" },
  isOwner: { type: Boolean, default: false },
});
defineEmits(["copy-invite", "remove"]);
</script>

<template>
  <div class="space-y-4">
    <div class="bg-[#A5E3FC]/20 border border-[#A5E3FC] rounded-lg p-3 mb-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-[#A5E3FC]">Invite link</div>
          <div class="text-xs text-[#A5E3FC]/80">
            Share this link to invite new members
          </div>
        </div>
        <button
          @click="$emit('copy-invite')"
          class="text-sm px-3 py-1.5 rounded-lg bg-[#A5E3FC]/30 hover:bg-[#A5E3FC]/50 transition-colors text-[#A5E3FC] flex items-center gap-2"
        >
          <i class="fas fa-link"></i>
          Copy link
        </button>
      </div>
    </div>

    <div class="space-y-2 max-h-60 overflow-y-auto">
      <div
        v-for="member in members"
        :key="member.id"
        class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
      >
        <div class="flex items-center gap-3">
          <div
            v-if="member.photoURL"
            class="w-8 h-8 rounded-full overflow-hidden"
          >
            <img
              :src="member.photoURL"
              :alt="member.displayName"
              class="w-full h-full object-cover"
            />
          </div>
          <div
            v-else
            class="w-8 h-8 rounded-full bg-[#C8A5FC] flex items-center justify-center text-white text-sm font-medium"
          >
            {{ member.displayName?.charAt(0).toUpperCase() || "?" }}
          </div>
          <div>
            <div class="text-sm font-medium dark:text-white">
              {{ member.displayName }}
            </div>
            <div
              v-if="member.id === ownerId"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              Owner
            </div>
          </div>
        </div>
        <button
          v-if="isOwner && member.id !== ownerId && member.id !== currentUserId"
          @click="$emit('remove', member.id)"
          class="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1"
        >
          <i class="fas fa-user-minus"></i>
          Remove
        </button>
      </div>
    </div>
  </div>
</template>
