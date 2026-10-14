// 全APIの共通処理: JWTの付与、エラーの形の統一、401ならログアウト

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

const TOKEN_KEY = 'snsTimeline.token'

// localStorage はプライベートブラウズ等で使えないことがあるため、失敗しても落ちないようにする
export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // 保存できなくても、このタブを開いている間はログイン状態を保てる
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // 何もしない
    }
  },
}

/** APIがエラーを返したときの例外。errors は [{ field, message }] */
export class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

let onUnauthorized = null

/** トークンが無効(401)だったときに呼ぶ処理を登録する(AuthProvider が logout を登録する) */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

/**
 * @param {string} path '/api/...' から始まるパス
 * @param {{ method?: string, body?: unknown, auth?: boolean }} options
 *   auth=false のAPI(ログイン・新規登録)は、401でもログアウト処理をしない
 */
export async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = tokenStorage.get()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'サーバーに接続できませんでした。時間をおいて再度お試しください')
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)

  if (!res.ok) {
    if (res.status === 401 && auth) onUnauthorized?.()
    throw new ApiError(
      res.status,
      data?.message ?? 'エラーが発生しました',
      Array.isArray(data?.errors) ? data.errors : [],
    )
  }
  return data
}
