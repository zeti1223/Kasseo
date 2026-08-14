<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGroupsStore } from '@/stores/groups'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const groupsStore = useGroupsStore()
const authStore = useAuthStore()

const loading = ref(false)
const error = ref('')

onMounted(() => {
  // Make sure user is authenticated
  if (!authStore.user) {
    error.value = 'You need to be signed in to join a fund.'
    setTimeout(() => {
      router.push({ name: 'login', query: { redirect: route.fullPath } })
    }, 2000)
  }
})

async function handleJoin() {
  if (!authStore.user) {
    error.value = 'You need to be signed in to join a fund.'
    return
  }

  loading.value = true
  error.value = ''
  try {
    console.log('Attempting to join group:', route.params.id)
    console.log('User:', authStore.user)
    await groupsStore.joinGroup(route.params.id)
    router.push({ name: 'group', params: { id: route.params.id } })
  } catch (e) {
    console.error('Join error:', e)
    error.value = 'Could not join this fund. The invite link may be invalid.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center" style="min-height: 80vh">
    <div class="bg-white dark:bg-surface-dark rounded-lg p-8 text-center shadow-lg max-w-[380px] w-full mx-4">
      <div class="w-14 h-14 bg-[#C8A5FC] rounded-full flex items-center justify-center mx-auto mb-3">
        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      </div>
      <h1 class="text-lg font-semibold mb-2 font-display dark:text-white">You've been invited to join a shared fund</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Joining lets you see and log transactions in this fund together.
      </p>
      <div v-if="error" class="bg-[#C1503A]/10 border border-[#C1503A] text-[#C1503A] rounded-lg p-3 mb-4">{{ error }}</div>
      <button
        @click="handleJoin"
        :disabled="loading"
        class="w-full px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg v-if="loading" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Join fund
      </button>
    </div>
  </div>
</template>
