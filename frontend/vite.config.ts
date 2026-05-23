import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',  // static 파일 (frontend/public → /). Vercel 배포에 포함되도록 frontend 내부로. (원본: rsc/static)
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
      },
      '/rsc': {
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
