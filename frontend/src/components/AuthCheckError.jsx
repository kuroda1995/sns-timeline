import { useAuth } from '../auth/useAuth.js'

/**
 * 保存済みのログイン情報をサーバーに確認できなかったときの表示(認証機能 処理のルール No.11)。
 * ログイン情報は消していないので、サーバーが動いていれば「再読み込み」でそのまま使える。
 */
export function AuthCheckError() {
  const { retry } = useAuth()
  return (
    <div className="notice" role="alert">
      <strong>サーバーに接続できませんでした</strong>
      <p>時間をおいて、もう一度お試しください。</p>
      <button type="button" className="btn btn--primary" onClick={retry}>
        再読み込み
      </button>
    </div>
  )
}
