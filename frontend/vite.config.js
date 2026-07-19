import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 构建产物输出到 athena/static/dist，由 FastAPI 托管。
// 开发时 `npm run dev` (5173) 通过 proxy 把 API 转发到 FastAPI (:8000)。
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/upload': 'http://127.0.0.1:8000',
      '/status': 'http://127.0.0.1:8000',
      '/download': 'http://127.0.0.1:8000',
      '/data': 'http://127.0.0.1:8000',
      '/player-clip': 'http://127.0.0.1:8000',
      '/analyze': 'http://127.0.0.1:8000',
      '/outputs': 'http://127.0.0.1:8000',
    },
  },
})
