import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: '../rsc/static',  // static 파일 서빙 경로 (rsc/static → /)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@rsc': path.resolve(__dirname, '../rsc'),
      '@static': path.resolve(__dirname, '../rsc/static'),
      '@brand': path.resolve(__dirname, '../rsc/static/brand'),
      '@food': path.resolve(__dirname, '../rsc/static/food'),
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    },
    fs: {
      // Allow serving files from rsc folder (parent directory)
      allow: ['..']
    }
  }
})
