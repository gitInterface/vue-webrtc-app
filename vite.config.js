import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: '', // 通常設為根目錄即可(保險起見)
  plugins: [
    vue(),
    vueDevTools(),
  ],
  css: {
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    hmr: {
      overlay: false // ❌ 關閉錯誤浮球
    },
    host: '0.0.0.0', // ⬅️ 讓其他裝置（如手機）也能連進來
    port: 5173,
  }
})
