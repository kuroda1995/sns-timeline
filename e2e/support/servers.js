// Playwright の webServer の設定(E2E・ブラウザ性能テストで共通)。
// テストの前にバックエンド(8080)と画面(5173)を起動し、終わったら止める。
//
// - 画面は本番と同じビルド(vite build → vite preview)で動かす。開発サーバー(npm run dev)は
//   ファイルを1つずつ変換して配信し、React も開発モード(StrictMode で処理が2回動く)になるため、
//   性能の計測にも、本番で起きる不具合の確認にも向かない
// - ポートは開発サーバーと同じ 8080・5173 で固定する(CLAUDE.md 5章)。使用中なら別のポートに逃げず、
//   Playwright がエラーで止まる。開発サーバーを止めてから実行する
// - 開発用DBにテストデータを書き込まないよう、起動済みのサーバーは使い回さない。
//   E2E_REUSE_SERVERS=1 のときだけ、自分で起動したサーバー(e2e プロファイルのバックエンドなど)を使う
import { API_URL, FRONT_URL } from './env.js'

const reuseExistingServer = !!process.env.E2E_REUSE_SERVERS

/**
 * @param {string} defaultProfiles バックエンドのプロファイル(ローカル用)。
 *   CI には application-local.properties が無いため、環境変数 E2E_BACKEND_PROFILES で上書きする
 */
export function webServers(defaultProfiles) {
  const profiles = process.env.E2E_BACKEND_PROFILES ?? defaultProfiles
  return [
    {
      name: 'backend',
      command: `node scripts/start-backend.mjs ${profiles}`,
      url: `${API_URL}/api/health`,
      // 初回は Gradle のビルドがあるため長めに待つ
      timeout: 300_000,
      reuseExistingServer,
      stdout: process.env.E2E_SERVER_LOG ? 'pipe' : 'ignore',
      stderr: 'pipe',
    },
    {
      name: 'frontend',
      // 開発用の dist/ を上書きしないよう、別のフォルダにビルドする
      command:
        'npx vite build --outDir dist-e2e --emptyOutDir --logLevel warn && ' +
        'npx vite preview --outDir dist-e2e --port 5173 --strictPort',
      cwd: '../frontend',
      url: FRONT_URL,
      // 本番ビルドでは APIのURLの既定が「同じオリジン」になるため、バックエンドのURLを埋め込む
      env: { ...process.env, VITE_API_BASE_URL: API_URL },
      timeout: 180_000,
      reuseExistingServer,
      stdout: process.env.E2E_SERVER_LOG ? 'pipe' : 'ignore',
      stderr: 'pipe',
    },
  ]
}
