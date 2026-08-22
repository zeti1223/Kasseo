<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { useAuthStore } from "@/stores/auth";
import AppNavbar from "@/components/layouts/AppNavbar.vue";
import AppFooter from "@/components/layouts/AppFooter.vue";

const authStore = useAuthStore();
const router = useRouter();

onMounted(() => {
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener("appUrlOpen", (event) => {
      try {
        const url = new URL(event.url);
        let path = "";
        if (url.protocol === "kasseo:") {
          path = (url.host ? `/${url.host}` : "") + url.pathname + url.search + url.hash;
        } else {
          path = url.pathname + url.search + url.hash;
        }
        if (path) {
          router.push(path);
        }
      } catch (err) {
        console.warn("Failed to handle deep link:", event.url, err);
      }
    });
  }
});
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
