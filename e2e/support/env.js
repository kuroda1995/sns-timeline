// E2E・ブラウザ性能テストで共通の定数

/** 画面のURL。バックエンドの CORS が http://localhost:5173 だけを許可しているため、ポートは固定(CLAUDE.md 5章) */
export const FRONT_URL = 'http://localhost:5173'

/** APIのURL(テストデータの準備で直接呼ぶ) */
export const API_URL = 'http://localhost:8080'

/** 画面がJWTを保存する localStorage のキー(frontend/src/api/http.js の TOKEN_STORAGE_KEY と同じ) */
export const TOKEN_STORAGE_KEY = 'snsTimeline.token'

/** テストで作るユーザーの共通パスワード(英字と数字を含む8文字以上) */
export const PASSWORD = 'e2ePass1234'

/** 1回に読み込む件数(要件定義書 8-1) */
export const PAGE_SIZE = 20

/** 新着投稿を確認する間隔(要件定義書 8-1、frontend/src/hooks/useNewPostsPolling.js) */
export const NEW_POSTS_INTERVAL_MS = 15_000
