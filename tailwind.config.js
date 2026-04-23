/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f6fbe8',
          100: '#ebf5d0',
          200: '#d5eba1',
          300: '#bbdc68',
          400: '#a5cf3a',
          500: '#95c11e',
          600: '#789a18',
          700: '#5c7512',
          800: '#465a0f',
          900: '#384a0d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
