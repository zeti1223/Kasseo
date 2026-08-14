import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const isDarkMode = ref(false)
  const nickname = ref('')

  // Load settings from localStorage on initialization
  function loadSettings() {
    const savedDarkMode = localStorage.getItem('darkMode')
    const savedNickname = localStorage.getItem('nickname')
    
    if (savedDarkMode !== null) {
      isDarkMode.value = savedDarkMode === 'true'
    }
    if (savedNickname !== null) {
      nickname.value = savedNickname
    }
  }

  // Watch for changes and save to localStorage
  watch(isDarkMode, (newValue) => {
    localStorage.setItem('darkMode', newValue.toString())
    applyTheme(newValue)
  })

  watch(nickname, (newValue) => {
    localStorage.setItem('nickname', newValue)
  })

  function applyTheme(dark) {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value
  }

  function setNickname(newNickname) {
    nickname.value = newNickname
  }

  return { 
    isDarkMode, 
    nickname, 
    loadSettings, 
    toggleDarkMode, 
    setNickname 
  }
})
