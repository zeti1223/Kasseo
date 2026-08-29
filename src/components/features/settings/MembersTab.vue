<script setup>
import { ref } from "vue";
import QrcodeVue from "qrcode.vue";

const props = defineProps({
  members: { type: Array, required: true },
  ownerId: { type: String, default: "" },
  currentUserId: { type: String, default: "" },
  isOwner: { type: Boolean, default: false },
  inviteUrl: { type: String, default: "" },
  qrInviteUrl: { type: String, default: "" },
});

const emit = defineEmits([
  "copy-invite",
  "remove",
  "transfer-ownership",
  "leave",
  "delete-fund",
  "add-placeholder-member",
]);

const showQr = ref(false);
const copied = ref(false);
const newMemberName = ref("");
const addingMember = ref(false);

// Tracks members whose photoURL failed to load, falling back to the
// initials avatar instead of a broken image icon.
const failedPhotoIds = ref(new Set());
function onPhotoError(id) {
  failedPhotoIds.value = new Set(failedPhotoIds.value).add(id);
}

function handleCopy() {
  emit("copy-invite");
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

function handleAddMember() {
  const trimmed = newMemberName.value.trim();
  if (!trimmed || addingMember.value) return;
  emit("add-placeholder-member", trimmed);
  newMemberName.value = "";
}
</script>

<template>
  <div class="space-y-4">
    <div class="bg-[#A5E3FC]/20 border border-[#A5E3FC] rounded-lg p-3 mb-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-medium text-[#A5E3FC]">{{ $t('fundSettings.inviteMembers') }}</div>
          <div class="text-xs text-[#A5E3FC]/80">
            {{ $t('fundSettings.inviteSubtitle') }}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="showQr = !showQr"
            :class="[
              'text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5',
              showQr
                ? 'bg-[#A5E3FC] text-gray-900 font-medium'
                : 'bg-[#A5E3FC]/30 hover:bg-[#A5E3FC]/50 text-[#A5E3FC]',
            ]"
            :title="showQr ? $t('common.hideQr') : $t('common.qrCode')"
          >
            <i class="fas fa-qrcode"></i>
            {{ showQr ? $t('common.hideQr') : $t('common.qrCode') }}
          </button>
          <button
            type="button"
            @click="handleCopy"
            class="text-sm px-3 py-1.5 rounded-lg bg-[#A5E3FC]/30 hover:bg-[#A5E3FC]/50 transition-colors text-[#A5E3FC] flex items-center gap-1.5"
          >
            <i :class="copied ? 'fas fa-check' : 'fas fa-link'"></i>
            {{ copied ? $t('common.copied') : $t('common.copyLink') }}
          </button>
        </div>
      </div>

      <div
        v-if="showQr && (qrInviteUrl || inviteUrl)"
        class="mt-4 pt-3 border-t border-[#A5E3FC]/30 flex flex-col items-center justify-center"
      >
        <div class="p-3 bg-white rounded-xl shadow-sm inline-block">
          <QrcodeVue
            :value="qrInviteUrl || inviteUrl"
            :size="160"
            level="M"
            render-as="svg"
          />
        </div>
        <p class="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          {{ $t('fundSettings.scanQrHelp') }}
        </p>
      </div>
    </div>

    <!-- Add member without account -->
    <div class="p-3 bg-gray-50 dark:bg-gray-700/60 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
      <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
        <span>{{ $t('fundSettings.addMemberWithoutAccount') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="newMemberName"
          type="text"
          :placeholder="$t('fundSettings.memberNamePlaceholder')"
          maxlength="50"
          :disabled="addingMember"
          @keyup.enter="handleAddMember"
          class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-800 dark:text-white"
        />
        <button
          type="button"
          @click="handleAddMember"
          :disabled="!newMemberName.trim() || addingMember"
          class="px-3 py-1.5 bg-[#C8A5FC] text-white text-xs font-semibold rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
        >
          <i class="fas fa-user-plus"></i>
          <span>{{ $t('fundSettings.add') || $t('common.create') }}</span>
        </button>
      </div>
      <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
        {{ $t('fundSettings.addMemberHelp') }}
      </p>
    </div>

    <div class="space-y-2 max-h-60 overflow-y-auto">
      <div
        v-for="member in members"
        :key="member.id"
        class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-2"
      >
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div
            v-if="member.photoURL && !failedPhotoIds.has(member.id)"
            class="w-8 h-8 rounded-full overflow-hidden shrink-0"
          >
            <img
              :src="member.photoURL"
              :alt="member.nickname || member.displayName"
              class="w-full h-full object-cover"
              @error="onPhotoError(member.id)"
            />
          </div>
          <div
            v-else
            class="w-8 h-8 rounded-full bg-[#C8A5FC] flex items-center justify-center text-white text-sm font-medium shrink-0"
          >
            {{
              (member.nickname || member.displayName)
                ?.charAt(0)
                .toUpperCase() || "?"
            }}
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium dark:text-white truncate flex items-center gap-1.5 flex-wrap">
              <span>{{ member.nickname || member.displayName }}</span>
              <span
                v-if="member.id === currentUserId"
                class="text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.2 rounded"
              >
                {{ $t('common.you') }}
              </span>
              <span
                v-if="member.isPlaceholder"
                class="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-normal flex items-center gap-1"
              >
                <i class="fas fa-user-clock text-[9px]"></i>
                {{ $t('common.noAccount') }}
              </span>
            </div>
            <div
              v-if="member.id === ownerId"
              class="text-xs text-primary dark:text-[#C8A5FC] font-medium flex items-center gap-1"
            >
              <i class="fas fa-crown text-[10px]"></i>
              {{ $t('common.owner') }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <button
            v-if="isOwner && member.id !== ownerId && !member.isPlaceholder"
            type="button"
            @click="$emit('transfer-ownership', { id: member.id, name: member.nickname || member.displayName })"
            class="text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-[#C8A5FC] text-xs px-2 py-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            :title="$t('fundSettings.transferOwnership')"
          >
            <i class="fas fa-crown"></i>
            <span class="hidden sm:inline">{{ $t('common.makeOwner') }}</span>
          </button>
          <button
            v-if="isOwner && member.id !== ownerId && member.id !== currentUserId"
            type="button"
            @click="$emit('remove', member.id)"
            class="text-red-600 hover:text-red-700 text-xs px-2 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1"
            :title="$t('common.remove')"
          >
            <i class="fas fa-user-minus"></i>
            <span>{{ $t('common.remove') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Danger Zone / Fund actions -->
    <div class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        {{ $t('common.dangerZone') }}
      </div>

      <div v-if="!isOwner" class="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg">
        <div>
          <div class="text-sm font-medium text-red-700 dark:text-red-400">
            {{ $t('fundSettings.leaveFund') }}
          </div>
          <div class="text-xs text-red-600/80 dark:text-red-400/70">
            {{ $t('fundSettings.leaveFundConfirm') }}
          </div>
        </div>
        <button
          type="button"
          @click="$emit('leave')"
          class="ml-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
        >
          <i class="fas fa-sign-out-alt"></i>
          {{ $t('common.leave') }}
        </button>
      </div>

      <div v-else class="space-y-2">
        <div class="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg">
          <div>
            <div class="text-sm font-medium text-red-700 dark:text-red-400">
              {{ $t('fundSettings.deleteFund') }}
            </div>
            <div class="text-xs text-red-600/80 dark:text-red-400/70">
              {{ $t('fundSettings.deleteFundConfirm') }}
            </div>
          </div>
          <button
            type="button"
            @click="$emit('delete-fund')"
            class="ml-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <i class="fas fa-trash-alt"></i>
            {{ $t('common.delete') }}
          </button>
        </div>
        <p v-if="members.length > 1" class="text-xs text-gray-500 dark:text-gray-400 px-1">
          {{ $t('fundSettings.ownerLeaveHelp') }}
        </p>
      </div>
    </div>
  </div>
</template>
