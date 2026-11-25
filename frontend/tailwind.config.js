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
        bg: 'var(--bg)',
        panelBg: 'var(--panel-bg)',
        cardBg: 'var(--card-bg)',
        cardHoverBg: 'var(--card-hover-bg)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        accentViolet: 'var(--accent-violet)',
        accentCyan: 'var(--accent-cyan)',
        borderCustom: 'var(--border)',
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
