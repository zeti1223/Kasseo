<script setup>
import { useAuthStore } from "@/stores/auth";
import AppNavbar from "@/components/layouts/AppNavbar.vue";

const authStore = useAuthStore();
</script>

<template>
  <div
    class="min-h-screen bg-background dark:bg-background-dark transition-colors"
  >
    <AppNavbar v-if="authStore.user" />
    <main>
      <router-view />
    </main>
  </div>
</template>
