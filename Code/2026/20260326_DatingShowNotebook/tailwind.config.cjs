/** @type {import('tailwindcss').Config} */
const path = require('path');
module.exports = {
  content: [
    path.join(__dirname, 'frontend/index.html'),
    path.join(__dirname, 'frontend/src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Aptos',
          'Calibri',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
