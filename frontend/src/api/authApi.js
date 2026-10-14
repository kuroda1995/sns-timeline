import { request } from './http.js'

/** A-01 新規登録 → { token, user } */
export function signup({ username, displayName, email, password }) {
  return request('/api/auth/signup', {
    method: 'POST',
    body: { username, displayName, email, password },
    auth: false,
  })
}

/** A-02 ログイン → { token, user } */
export function login({ email, password }) {
  return request('/api/auth/login', { method: 'POST', body: { email, password }, auth: false })
}

/** A-03 ログイン中のユーザー情報 → user */
export function me() {
  return request('/api/auth/me')
}
