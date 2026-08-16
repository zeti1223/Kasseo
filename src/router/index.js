import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import LoginView from "@/views/LoginView.vue";
import LandingView from "@/views/LandingView.vue";
import DashboardView from "@/views/DashboardView.vue";
import GroupView from "@/views/GroupView.vue";
import JoinView from "@/views/JoinView.vue";

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

// Safe to read synchronously: main.js waits for authStore.init() to
// resolve before it mounts the app / performs the first navigation.
router.beforeEach((to) => {
  const authStore = useAuthStore();

  // Wait for auth state to be ready before making routing decisions
  if (!authStore.isReady) {
    return true; // Let it proceed, main.js already waited for init()
  }

  const isAuthed = !!authStore.user;

  if (to.meta.requiresAuth && !isAuthed) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "login" && isAuthed) {
    // Ha van redirect query paraméter, oda irányítunk, különben a dashboardra
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
