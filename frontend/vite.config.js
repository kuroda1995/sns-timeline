import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // バックエンドのCORS設定が http://localhost:5173 だけを許可しているため、ポートは固定する。
    // 5173が使用中なら別ポートに逃げずに起動を失敗させる(CLAUDE.md 5章)
    port: 5173,
    strictPort: true,
  },
})
