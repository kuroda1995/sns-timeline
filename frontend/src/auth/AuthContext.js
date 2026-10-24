import { createContext } from 'react'

/**
 * ログイン中のユーザー情報を全画面で共有する。
 * 値: { user, status: 'loading' | 'authenticated' | 'guest' | 'error', login(), signup(), logout(), updateUser(), retry() }
 * 'error' は保存済みのトークンをサーバーに確認できなかった状態(トークンは消していない)。retry() で確認し直す。
 */
export const AuthContext = createContext(null)
