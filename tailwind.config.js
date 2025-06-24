/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        chrome: {
          bg: '#f1f3f4',
          border: '#dadce0',
          tab: '#ffffff',
          'tab-active': '#ffffff',
          'tab-hover': '#f8f9fa',
          'address-bar': '#ffffff',
          sidebar: '#f9f9f9',
          'sidebar-dark': '#202124',
        }
      },
      fontFamily: {
        'chrome': ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}