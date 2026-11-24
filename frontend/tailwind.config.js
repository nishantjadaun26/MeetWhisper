/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#09090F',
        textPrimary: '#F1EFFA',
        textSecondary: '#B3AFCB',
        accentViolet: '#C4B5FD',
        accentCyan: '#67E8F9',
        borderCustom: '#2E2B45',
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
