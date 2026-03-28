/** @type {import('tailwindcss').Config} */
const path = require('path');
module.exports = {
  content: [
    path.join(__dirname, 'frontend/index.html'),
    path.join(__dirname, 'frontend/src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
