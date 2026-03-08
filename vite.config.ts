import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api/hero-list": {
        target: "https://game.gtimg.cn",
        changeOrigin: true,
        rewrite: () => "/images/lgamem/act/lrlib/js/heroList/hero_list.js",
      },
      "/api/hero-rank-list": {
        target: "https://mlol.qt.qq.com",
        changeOrigin: true,
        rewrite: () => "/go/lgame_battle_info/hero_rank_list_v2",
        headers: {
          Referer: "https://lolm.qq.com/act/a20220818raider/index.html",
          "User-Agent": "Mozilla/5.0",
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
