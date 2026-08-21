/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAF7F1',
        'background-dark': '#1a1a2e',
        surface: '#FFFFFF',
        'surface-dark': '#16213e',
        primary: {
          DEFAULT: '#C8A5FC',
          dark: '#A78BCA',
          'dark-dark': '#8B6FB0',
        },
        secondary: '#A5E3FC',
        success: '#A7F49D',
        error: '#C1503A',
        info: '#A5E3FC',
        warning: '#D89B3C',
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Inter"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      textColor: {
        'success': '#A7F49D',
        'error': '#C1503A',
        'info': '#A5E3FC',
        'warning': '#D89B3C',
        'primary-dark': '#A78BCA',
      },
      backgroundColor: {
        'info': '#A5E3FC',
      }
    },
  },
  plugins: [],
}
