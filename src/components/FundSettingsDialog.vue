<script setup>
import { ref, computed, watch } from 'vue'
import { useGroupsStore } from '@/stores/groups'
import { useAuthStore } from '@/stores/auth'
import { ref as dbRef, get } from 'firebase/database'
import { db } from '@/firebase/config'

const props = defineProps({ modelValue: Boolean, group: Object })
const emit = defineEmits(['update:modelValue'])

const groupsStore = useGroupsStore()
const authStore = useAuthStore()

const activeTab = ref('currency')
const currency = ref('USD')
const currencies = ['USD', 'EUR', 'HUF', 'GBP']
const loading = ref(false)

const newCategory = ref('')
const categories = ref([])

const showRemoveMemberConfirm = ref(null)
const showRemoveCategoryConfirm = ref(null)

const isOwner = computed(() => props.group?.ownerId === authStore.user?.uid)

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.group) {
    currency.value = props.group.currency
    loadCategories()
  }
})

async function loadCategories() {
  if (!props.group?.id) return
  const snap = await get(dbRef(db, `groups/${props.group.id}/categories`))
  categories.value = snap.exists() 
    ? Object.entries(snap.val()).map(([id, cat]) => ({ id, ...cat }))
    : []
}

async function handleCurrencyChange() {
  if (!props.group?.id) return
  loading.value = true
  try {
    await groupsStore.updateCurrency(props.group.id, currency.value)
    await groupsStore.loadGroup(props.group.id)
    emit('update:modelValue', false)
  } finally {
    loading.value = false
  }
}

async function handleAddCategory() {
  if (!newCategory.value.trim() || !props.group?.id) return
  loading.value = true
  try {
    await groupsStore.addCategory(props.group.id, newCategory.value.trim())
    newCategory.value = ''
    await loadCategories()
  } finally {
    loading.value = false
  }
}

async function handleRemoveCategory(categoryId) {
  if (!props.group?.id) return
  loading.value = true
  try {
    await groupsStore.removeCategory(props.group.id, categoryId)
    await loadCategories()
    showRemoveCategoryConfirm.value = null
  } finally {
    loading.value = false
  }
}

async function handleRemoveMember(userId) {
  if (!props.group?.id) return
  loading.value = true
  try {
    await groupsStore.removeMember(props.group.id, userId)
    showRemoveMemberConfirm.value = null
  } finally {
    loading.value = false
  }
}

function copyInviteLink() {
  if (!props.group?.id) return
  const url = `${window.location.origin}/join/${props.group.id}`
  navigator.clipboard.writeText(url)
}

const members = computed(() => {
  if (!props.group?.members) return []
  return Object.entries(props.group.members).map(([id, member]) => ({ id, ...member }))
})
</script>

<template>
  <div v-if="props.modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" @click="emit('update:modelValue', false)" />
    <div class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[500px] mx-4 max-h-[90vh] overflow-y-auto">
      <h2 class="text-lg font-semibold font-display mb-4 dark:text-white">Fund Settings</h2>
      
      <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <button
          @click="activeTab = 'currency'"
          :class="[
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'currency' 
              ? 'border-b-2 border-[#C8A5FC] text-[#C8A5FC]' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          ]"
        >
          Currency
        </button>
        <button
          @click="activeTab = 'members'"
          :class="[
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'members' 
              ? 'border-b-2 border-[#C8A5FC] text-[#C8A5FC]' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          ]"
        >
          Members
        </button>
        <button
          @click="activeTab = 'categories'"
          :class="[
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'categories' 
              ? 'border-b-2 border-[#C8A5FC] text-[#C8A5FC]' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          ]"
        >
          Categories
        </button>
      </div>

      <div v-if="activeTab === 'currency'" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current currency</label>
          <select
            v-model="currency"
            :disabled="!isOwner"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white"
          >
            <option v-for="curr in currencies" :key="curr" :value="curr">{{ curr }}</option>
          </select>
          <p v-if="!isOwner" class="text-xs text-gray-500 dark:text-gray-400 mt-1">Only the owner can change currency</p>
        </div>
        <div v-if="isOwner" class="flex justify-end gap-2">
          <button
            @click="emit('update:modelValue', false)"
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleCurrencyChange"
            :disabled="loading"
            class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>

      <div v-if="activeTab === 'members'" class="space-y-4">
        <div class="bg-[#A5E3FC]/20 border border-[#A5E3FC] rounded-lg p-3 mb-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-[#A5E3FC]">Invite link</div>
              <div class="text-xs text-[#A5E3FC]/80">Share this link to invite new members</div>
            </div>
            <button
              @click="copyInviteLink"
              class="text-sm px-3 py-1.5 rounded-lg bg-[#A5E3FC]/30 hover:bg-[#A5E3FC]/50 transition-colors text-[#A5E3FC]"
            >
              Copy link
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <div v-for="member in members" :key="member.id" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div class="flex items-center gap-3">
              <div v-if="member.photoURL" class="w-8 h-8 rounded-full overflow-hidden">
                <img :src="member.photoURL" :alt="member.displayName" class="w-full h-full object-cover" />
              </div>
              <div v-else class="w-8 h-8 rounded-full bg-[#C8A5FC] flex items-center justify-center text-white text-sm font-medium">
                {{ member.displayName?.charAt(0).toUpperCase() || '?' }}
              </div>
              <div>
                <div class="text-sm font-medium dark:text-white">{{ member.displayName }}</div>
                <div v-if="member.id === props.group?.ownerId" class="text-xs text-gray-500 dark:text-gray-400">Owner</div>
              </div>
            </div>
            <button
              v-if="isOwner && member.id !== props.group?.ownerId && member.id !== authStore.user?.uid"
              @click="showRemoveMemberConfirm = member.id"
              class="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>

        <div v-if="showRemoveMemberConfirm" class="fixed inset-0 z-60 flex items-center justify-center">
          <div class="absolute inset-0 bg-black/50" @click="showRemoveMemberConfirm = null" />
          <div class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[400px] mx-4">
            <h3 class="text-lg font-semibold mb-2 dark:text-white">Remove member?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">This member will lose access to this fund.</p>
            <div class="flex justify-end gap-2">
              <button
                @click="showRemoveMemberConfirm = null"
                class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleRemoveMember(showRemoveMemberConfirm)"
                :disabled="loading"
                class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'categories'" class="space-y-4">
        <div v-if="isOwner" class="flex gap-2">
          <input
            v-model="newCategory"
            type="text"
            placeholder="New category name"
            class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C8A5FC] focus:border-transparent dark:bg-gray-700 dark:text-white"
            @keyup.enter="handleAddCategory"
          />
          <button
            @click="handleAddCategory"
            :disabled="!newCategory.trim() || loading"
            class="px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        <p v-if="!isOwner" class="text-xs text-gray-500 dark:text-gray-400">Only the owner can add categories</p>

        <div class="space-y-2">
          <div v-for="category in categories" :key="category.id" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span class="text-sm dark:text-white">{{ category.name }}</span>
            <button
              v-if="isOwner"
              @click="showRemoveCategoryConfirm = category.id"
              class="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              Remove
            </button>
          </div>
          <div v-if="categories.length === 0" class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No custom categories yet
          </div>
        </div>

        <div v-if="showRemoveCategoryConfirm" class="fixed inset-0 z-60 flex items-center justify-center">
          <div class="absolute inset-0 bg-black/50" @click="showRemoveCategoryConfirm = null" />
          <div class="relative bg-white dark:bg-surface-dark rounded-lg shadow-lg p-6 w-full max-w-[400px] mx-4">
            <h3 class="text-lg font-semibold mb-2 dark:text-white">Remove category?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">This category will be removed from the fund.</p>
            <div class="flex justify-end gap-2">
              <button
                @click="showRemoveCategoryConfirm = null"
                class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleRemoveCategory(showRemoveCategoryConfirm)"
                :disabled="loading"
                class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab !== 'currency'" class="flex justify-end mt-6">
        <button
          @click="emit('update:modelValue', false)"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
