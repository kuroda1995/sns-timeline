import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth.js'

/** ログインしていなければログイン画面へ移動させる(AUTH-05) */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <p className="loading">読み込み中…</p>
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
