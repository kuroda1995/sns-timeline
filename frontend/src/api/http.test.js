import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request, setUnauthorizedHandler, TOKEN_STORAGE_KEY, tokenStorage } from './http.js'

/** fetch の結果を作る */
function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: body === undefined ? () => Promise.reject(new SyntaxError('no body')) : () => Promise.resolve(body),
  }
}

describe('request', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    setUnauthorizedHandler(null)
  })

  it('保存済みのJWTを Authorization ヘッダーに付けて、レスポンスのJSONを返す', async () => {
    tokenStorage.set('jwt-token')
    fetchMock.mockResolvedValue(response(200, { id: 1 }))

    await expect(request('/api/auth/me')).resolves.toEqual({ id: 1 })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/auth\/me$/)
    expect(options).toEqual({ method: 'GET', headers: { Authorization: 'Bearer jwt-token' }, body: undefined })
  })

  it('body はJSONにして Content-Type を付ける', async () => {
    fetchMock.mockResolvedValue(response(201, { ok: true }))

    await request('/api/posts/1', { method: 'PUT', body: { content: 'a' } })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('PUT')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(options.body).toBe('{"content":"a"}')
  })

  it('FormData はそのまま送り、Content-Type はブラウザに任せる', async () => {
    fetchMock.mockResolvedValue(response(201, {}))
    const form = new FormData()
    form.append('content', 'a')

    await request('/api/posts', { method: 'POST', body: form })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.body).toBe(form)
    expect(options.headers).not.toHaveProperty('Content-Type')
  })

  it('auth=false のときはJWTを付けない', async () => {
    tokenStorage.set('jwt-token')
    fetchMock.mockResolvedValue(response(200, {}))

    await request('/api/auth/login', { method: 'POST', body: {}, auth: false })

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
  })

  it('204 は本文を読まずに null を返す', async () => {
    fetchMock.mockResolvedValue(response(204))

    await expect(request('/api/posts/1', { method: 'DELETE' })).resolves.toBeNull()
  })

  it('エラーのときはサーバーのメッセージと項目ごとのエラーを ApiError にする', async () => {
    fetchMock.mockResolvedValue(
      response(400, { status: 400, message: '入力内容に誤りがあります', errors: [{ field: 'email', message: 'x' }] }),
    )

    const error = await request('/api/auth/signup').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.message).toBe('入力内容に誤りがあります')
    expect(error.errors).toEqual([{ field: 'email', message: 'x' }])
  })

  it('エラーの本文がJSONでなければ共通のメッセージにする', async () => {
    fetchMock.mockResolvedValue(response(502))

    await expect(request('/api/timeline')).rejects.toMatchObject({
      status: 502,
      message: 'エラーが発生しました',
      errors: [],
    })
  })

  it('サーバーに接続できなければ status 0 の ApiError にする', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(request('/api/timeline')).rejects.toMatchObject({
      status: 0,
      message: 'サーバーに接続できませんでした。時間をおいて再度お試しください',
    })
  })

  it('401 なら登録した処理(ログアウト)を呼ぶ', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    fetchMock.mockResolvedValue(response(401, { message: 'ログインしてください' }))

    await expect(request('/api/timeline')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('ログインのように auth=false のAPIでは、401でもログアウトしない', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    fetchMock.mockResolvedValue(response(401, { message: 'メールアドレスまたはパスワードが違います' }))

    await expect(request('/api/auth/login', { auth: false })).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('tokenStorage', () => {
  it('localStorage に保存・取得・削除する', () => {
    tokenStorage.set('abc')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('abc')
    expect(tokenStorage.get()).toBe('abc')

    tokenStorage.clear()
    expect(tokenStorage.get()).toBeNull()
  })

  it('localStorage が使えなくてもエラーにしない', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => tokenStorage.set('abc')).not.toThrow()
    expect(tokenStorage.get()).toBeNull()
  })
})
