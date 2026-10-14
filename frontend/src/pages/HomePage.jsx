import { useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth.js'

/**
 * SC-03 タイムライン(仮)。
 * タイムライン機能を実装するまでは、ログインできたことの確認とログアウト(AUTH-03)だけを置く。
 */
export function HomePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    // 確認ダイアログは出さない(認証機能.md「ログアウト」)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="placeholder">
      <div className="placeholder__card">
        <h1 className="auth__logo">SNS TimeLine</h1>
        <p className="placeholder__greeting">
          Hello, {user.displayName} さん <span className="placeholder__username">@{user.username}</span>
        </p>
        <p className="field__hint">ログインに成功しました。タイムラインは準備中です。</p>
        <button type="button" className="btn btn--outline" onClick={handleLogout}>
          ログアウト
        </button>
      </div>
    </main>
  )
}
