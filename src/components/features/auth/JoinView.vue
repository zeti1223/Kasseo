<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useGroupsStore } from "@/stores/groups";
import { useAuthStore } from "@/stores/auth";
import { useTranslation } from "i18next-vue";
import LanguageSelector from "@/components/common/LanguageSelector.vue";

const route = useRoute();
const router = useRouter();
const groupsStore = useGroupsStore();
const authStore = useAuthStore();
const { t } = useTranslation();

const loading = ref(false);
const error = ref("");

onMounted(() => {
  if (!authStore.user) {
    error.value = t("join.signInRequired");
    setTimeout(() => {
      router.push({ name: "login", query: { redirect: route.fullPath } });
    }, 2000);
  }
});

async function handleJoin() {
  if (!authStore.user) {
    error.value = t("join.signInRequired");
    return;
  }

  loading.value = true;
  error.value = "";
  try {
    await groupsStore.joinGroup(route.params.id);
    router.push({ name: "group", params: { id: route.params.id } });
  } catch (e) {
    console.error("Join error:", e);
    error.value = t("join.invalidLink");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex items-center justify-center relative" style="min-height: 80vh">
    <div class="absolute top-4 right-4 z-10">
      <LanguageSelector variant="dropdown" />
    </div>

    <div
      class="bg-white dark:bg-surface-dark rounded-lg p-8 text-center shadow-lg max-w-[380px] w-full mx-4"
    >
      <div
        class="w-14 h-14 bg-[#C8A5FC] rounded-full flex items-center justify-center mx-auto mb-3"
      >
        <i class="fas fa-user-plus text-white"></i>
      </div>
      <h1 class="text-lg font-semibold mb-2 font-display dark:text-white">
        {{ $t('join.title') }}
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {{ $t('join.subtitle') }}
      </p>
      <div
        v-if="error"
        class="bg-[#C1503A]/10 border border-[#C1503A] text-[#C1503A] rounded-lg p-3 mb-4"
      >
        {{ error }}
      </div>
      <button
        @click="handleJoin"
        :disabled="loading"
        class="w-full px-4 py-2 bg-[#C8A5FC] text-white rounded-lg hover:bg-[#A78BCA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin"></i>
        {{ $t('join.joinFund') }}
      </button>
    </div>
  </div>
</template>
