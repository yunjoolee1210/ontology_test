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
          indigo: '#4338CA',
          lavender: '#9F7AEA',
          purpleLight: '#F3E8FF',
          indigoLight: '#E0E7FF',
        }
      }
    },
  },
  plugins: [],
}
