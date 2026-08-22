<script setup>
import { useAuthStore } from "@/stores/auth";
import AppNavbar from "@/components/layouts/AppNavbar.vue";
import AppFooter from "@/components/layouts/AppFooter.vue";

const authStore = useAuthStore();
</script>

<template>
  <div
    class="min-h-screen bg-background dark:bg-background-dark transition-colors flex flex-col justify-between"
  >
    <div class="flex-1 flex flex-col">
      <AppNavbar v-if="authStore.user" />
      <main class="flex-1">
        <router-view />
      </main>
    </div>
    <AppFooter />
  </div>
</template>
