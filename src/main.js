import { createApp } from 'vue'
import { createPinia } from 'pinia'
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
} from 'chart.js'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useSettingsStore } from './stores/settings'
import './assets/main.css'

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
  Filler
)

const app = createApp(App)
app.use(createPinia())
app.use(router)

// Wait for Firebase to report the initial auth state before the first
// route is resolved, so the /login redirect guard never gets a false
// negative on page refresh.
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

// Load settings (including theme) before mounting
settingsStore.loadSettings()

authStore.init().then(() => {
  app.mount('#app')
})
