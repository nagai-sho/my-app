/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        income: '#2563eb',
        expense: '#dc2626',
        ink: '#111827',
      },
    },
  },
  plugins: [],
};
