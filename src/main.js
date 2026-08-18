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

// app.use(router) must happen AFTER authStore.init() resolves, so the
// redirect guards in router/index.js see the real auth state on first load.
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

settingsStore.loadSettings();

authStore.init().then(() => {
  app.use(router);
  app.mount("#app");
});
