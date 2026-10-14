import { useCallback, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/authApi.js'
import { setUnauthorizedHandler, tokenStorage } from '../api/http.js'
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

  const value = useMemo(
    () => ({ user, status, login, signup, logout }),
    [user, status, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
