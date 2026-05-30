/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kongdang: {
          purple: '#6D3FA0',
          red: '#C0392B',
          purpleLight: '#F3E8FF',
          redLight: '#FDEDEC',
        }
      }
    },
  },
  plugins: [],
}
