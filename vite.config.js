import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    // 배치도 3D 화면: 저장소 파일을 같은 주소로 읽기 (netlify.toml 의 /fbfiles 와 같음)
    proxy: {
      '/fbfiles': {
        target: 'https://firebasestorage.googleapis.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/fbfiles/, ''),
      },
    },
  }
})
