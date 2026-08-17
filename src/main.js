import { createApp } from "vue";
import { createPinia } from "pinia";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Filler,
} from "chart.js";

import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "./stores/auth";
import { useSettingsStore } from "./stores/settings";
import "./assets/main.css";
import "@fortawesome/fontawesome-free/css/all.css";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Filler,
);

const app = createApp(App);
app.use(createPinia());

// Wait for Firebase to report the initial auth state before the first
// route is resolved, so the / -> /dashboard and /login redirect guards
// never get a false negative on page refresh.
//
// NOTE: app.use(router) triggers Vue Router's initial navigation
// synchronously, so it must happen AFTER authStore.init() resolves -
// otherwise the beforeEach guard runs with isReady still false, lets
// the very first navigation through unchecked, and never re-evaluates
// it once the auth state becomes known.
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

// Load settings (including theme) before mounting
settingsStore.loadSettings();

authStore.init().then(() => {
  app.use(router);
  app.mount("#app");
});
