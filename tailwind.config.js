/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          600: '#1e3a8a',
          700: '#172554',
          800: '#0f172a',
          900: '#0a1128',
        },
        brandOrange: {
          50: '#fff7ed',
          100: '#ffedd5',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        }
      },
      fontFamily: {
        heading: ['Prompt', 'sans-serif'],
        body: ['Sarabun', 'sans-serif'],
      }
    },
  },
  plugins: [],
}