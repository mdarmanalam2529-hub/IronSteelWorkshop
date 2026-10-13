/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: {
          50: '#f6f7f8',
          100: '#e3e6ea',
          200: '#c6ccd4',
          300: '#9aa3b0',
          400: '#6b7585',
          500: '#4a5360',
          600: '#363d48',
          700: '#272d36',
          800: '#1c2128',
          900: '#15191f',
          950: '#0c0f13',
        },
        steel: {
          50: '#f0f4f8',
          100: '#e0e9f0',
          200: '#c5d3e0',
          300: '#9bb0c4',
          400: '#6d8aa8',
          500: '#4d6d8f',
          600: '#3a566f',
          700: '#2f455a',
          800: '#283a4c',
          900: '#1e2a37',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
