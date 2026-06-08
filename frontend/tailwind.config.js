/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'allys': {
          black: '#0a0a0a',
          darker: '#111111',
          dark: '#1a1a1a',
          gray: '#2a2a2a',
          light: '#3a3a3a',
          text: '#e5e5e5',
          muted: '#888888',
          accent: '#ffffff',
        },
        'fab-navy': '#003DA5',
        'fab-navy-dark': '#001E5C',
        'fab-red': '#E1261C',
        'fab-gold': '#A37E2C',
        'fab-cream': '#F4F1EA',
        'fab-text': '#1A1A1A',
        'fab-muted': '#6B7280',
        'fab-light': '#FFFFFF',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
