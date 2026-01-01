/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Teko', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        street: {
          900: '#0a0a0a',
          800: '#1a1a1a',
          700: '#2a2a2a',
          accent: '#ffd700',
          accentHover: '#ffed4e',
        },
      },
    },
  },
  plugins: [],
}