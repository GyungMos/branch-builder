import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const bucket = (env.VITE_FIREBASE_STORAGE_BUCKET || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return {
    plugins: [react()],
    server: {
      port: 3000,
      open: true,
      // 배치도 3D 화면: 우리 저장소 파일만 같은 주소로 읽기 (netlify.toml 의 /fbfiles 와 같음)
      proxy: bucket ? {
        [`^/fbfiles/v0/b/${bucket}/o/`]: {
          target: 'https://firebasestorage.googleapis.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/fbfiles/, ''),
        },
      } : {},
    },
  }
})
