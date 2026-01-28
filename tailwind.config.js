/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./index-v2.html",
    "./renderer.js",
    "./renderer-v2.js"
  ],
  theme: {
    extend: {
      colors: {
        'bass-pink': '#ff4ad5',
        'bass-purple': '#ff6b9d',
        'bass-dark': '#0a0a0a',
        'bass-card': '#1a1a1a',
        'bass-accent': '#4a9eff',
      },
      backgroundImage: {
        'bass-gradient': 'linear-gradient(135deg, #ff4ad5 0%, #ff6b9d 100%)',
        'bass-gradient-dark': 'linear-gradient(135deg, rgba(255, 74, 213, 0.2) 0%, rgba(255, 107, 157, 0.2) 100%)',
      },
      boxShadow: {
        'bass-glow': '0 0 20px rgba(255, 74, 213, 0.3)',
        'bass-card': '0 8px 32px rgba(0, 0, 0, 0.5)',
        'bass-inset': 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}