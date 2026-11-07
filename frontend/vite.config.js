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
  // 単体テスト・コンポーネントテスト(設計書 7)。ブラウザの代わりに jsdom で画面を組み立てる
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // テストごとにモック(vi.fn・vi.mock・vi.spyOn)を元に戻し、テスト同士で影響しないようにする
    mockReset: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
})
