import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth.js'

/**
 * ログイン済みでログイン画面・新規登録画面を開いたら、ホームへ移動させる。
 * ログイン直後もここを通るので、ログイン画面に飛ばされる前に開こうとしていた画面があればそこへ戻す。
 */
export function GuestOnly() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <p className="loading">読み込み中…</p>
  if (status === 'authenticated') {
    return <Navigate to={location.state?.from?.pathname ?? '/'} replace />
  }
  return <Outlet />
}
