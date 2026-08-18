import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import LoginView from "@/components/features/auth/LoginView.vue";
import LandingView from "@/views/LandingView.vue";
import DashboardView from "@/views/DashboardView.vue";
import GroupView from "@/views/GroupView.vue";
import JoinView from "@/components/features/auth/JoinView.vue";

const routes = [
  { path: "/login", name: "login", component: LoginView },
  {
    path: "/",
    name: "landing",
    component: LandingView,
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: DashboardView,
    meta: { requiresAuth: true },
  },
  {
    path: "/group/:id",
    name: "group",
    component: GroupView,
    meta: { requiresAuth: true },
  },
  {
    path: "/join/:id",
    name: "join",
    component: JoinView,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Safe to read synchronously: main.js waits for authStore.init() first.
router.beforeEach((to) => {
  const authStore = useAuthStore();

  if (!authStore.isReady) {
    return true;
  }

  const isAuthed = !!authStore.user;

  if (to.meta.requiresAuth && !isAuthed) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "login" && isAuthed) {
    // Go to the redirect target if there is one, otherwise the dashboard.
    const redirectPath = to.query.redirect;
    if (redirectPath && redirectPath !== "/login") {
      return redirectPath;
    }
    return { name: "dashboard" };
  }
  if (to.name === "landing" && isAuthed) {
    return { name: "dashboard" };
  }
  return true;
});

export default router;
