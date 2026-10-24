import { useCallback, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/authApi.js'
import { setUnauthorizedHandler, TOKEN_STORAGE_KEY, tokenStorage } from '../api/http.js'
import { AuthContext } from './AuthContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // トークンがあれば /me で確認するまで「確認中」にする(AUTH-04)
  const [status, setStatus] = useState(() => (tokenStorage.get() ? 'loading' : 'guest'))

  const logout = useCallback(() => {
    tokenStorage.clear()
    setUser(null)
    setStatus('guest')
  }, [])

  const acceptAuth = useCallback(({ token, user: loggedInUser }) => {
    tokenStorage.set(token)
    setUser(loggedInUser)
    setStatus('authenticated')
  }, [])

  const login = useCallback(
    async (credentials) => acceptAuth(await authApi.login(credentials)),
    [acceptAuth],
  )

  const signup = useCallback(
    async (form) => acceptAuth(await authApi.signup(form)),
    [acceptAuth],
  )

  // どのAPIでも401が返ったらログアウトする(処理のルール No.3)
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // ページを開いたとき、保存済みのトークンが有効か確認する(処理のルール No.4)
  useEffect(() => {
    if (!tokenStorage.get()) return
    let cancelled = false
    authApi
      .me()
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!cancelled) logout()
      })
    return () => {
      cancelled = true
    }
  }, [logout])

  // 保存済みのトークンと画面の状態を合わせ直す。
  // ・「戻る」でブラウザがログイン中だったページをメモリから復元したとき(Back-Forward Cache)
  // ・別のタブでログイン/ログアウトしたとき
  // のどちらも、Reactの状態は古いままになるため
  useEffect(() => {
    const sync = () => {
      if (!tokenStorage.get()) {
        logout()
        return
      }
      authApi
        .me()
        .then((me) => {
          setUser(me)
          setStatus('authenticated')
        })
        .catch(logout)
    }
    const handlePageShow = (e) => {
      if (e.persisted) sync()
    }
    const handleStorage = (e) => {
      // e.key が null になるのは localStorage.clear() のとき
      if (e.key === TOKEN_STORAGE_KEY || e.key === null) sync()
    }
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('storage', handleStorage)
    }
  }, [logout])

  /** プロフィールを更新したときに、サイドメニューなどに出ている自分の情報も書き換える */
  const updateUser = useCallback((patch) => {
    setUser((current) => (current ? { ...current, ...patch } : current))
  }, [])

  const value = useMemo(
    () => ({ user, status, login, signup, logout, updateUser }),
    [user, status, login, signup, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
