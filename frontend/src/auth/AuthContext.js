import { createContext } from 'react'

/**
 * ログイン中のユーザー情報を全画面で共有する。
 * 値: { user, status: 'loading' | 'authenticated' | 'guest', login(), signup(), logout() }
 */
export const AuthContext = createContext(null)
