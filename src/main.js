import { createApp } from "vue";
import { createPinia } from "pinia";
import I18NextVue from "i18next-vue";
import i18next from "./i18n";
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
import { useNotificationsStore } from "./stores/notifications";
import "./assets/main.css";
import "@fortawesome/fontawesome-free/css/all.css";
import "flag-icons/css/flag-icons.min.css";

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
app.use(I18NextVue, { i18next });

// app.use(router) must happen AFTER authStore.init() resolves, so the
// redirect guards in router/index.js see the real auth state on first load.
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const notificationsStore = useNotificationsStore();

settingsStore.loadSettings();
notificationsStore.init();

authStore.init().then(() => {
  app.use(router);
  app.mount("#app");
});
