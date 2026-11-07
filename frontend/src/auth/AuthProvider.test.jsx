import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import * as authApi from '../api/authApi.js'
import { ApiError, request, TOKEN_STORAGE_KEY, tokenStorage } from '../api/http.js'
import { CURRENT_USER } from '../test/fixtures.js'
import { AuthProvider } from './AuthProvider.jsx'
import { useAuth } from './useAuth.js'

vi.mock('../api/authApi.js')

/** ログイン状態を表示し、ボタンで操作できるようにする */
function Probe() {
  const { user, status, login, logout, retry, updateUser } = useAuth()
  return (
    <>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user?.displayName ?? 'なし'}</p>
      <button onClick={() => login({ email: 'hanako@example.com', password: 'password123' }).catch(() => {})}>
        login
      </button>
      <button onClick={logout}>logout</button>
      <button onClick={retry}>retry</button>
      <button onClick={() => updateUser({ displayName: '花子2' })}>update</button>
    </>
  )
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
const status = () => screen.getByTestId('status')

describe('AuthProvider', () => {
  it('トークンが保存されていなければ、未ログインとして始める', () => {
    renderProvider()

    expect(status()).toHaveTextContent('guest')
    expect(authApi.me).not.toHaveBeenCalled()
  })

  it('トークンが保存されていれば、確認中にしてからサーバーに確かめる', async () => {
    tokenStorage.set('saved-token')
    authApi.me.mockResolvedValue(CURRENT_USER)
    renderProvider()

    expect(status()).toHaveTextContent('loading')
    await waitFor(() => expect(status()).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('user')).toHaveTextContent('花子')
  })

  it('保存済みのトークンが無効(401)なら、トークンを消して未ログインにする', async () => {
    tokenStorage.set('expired-token')
    authApi.me.mockRejectedValue(new ApiError(401, 'ログインしてください'))
    renderProvider()

    await waitFor(() => expect(status()).toHaveTextContent('guest'))
    expect(tokenStorage.get()).toBeNull()
  })

  it('サーバーにつながらなければ、トークンを残してエラーにし、「再読み込み」で確かめ直す', async () => {
    tokenStorage.set('saved-token')
    authApi.me.mockRejectedValueOnce(new ApiError(0, 'サーバーに接続できませんでした')).mockResolvedValueOnce(CURRENT_USER)
    renderProvider()

    await waitFor(() => expect(status()).toHaveTextContent('error'))
    expect(tokenStorage.get()).toBe('saved-token')

    await userEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(status()).toHaveTextContent('authenticated'))
  })

  it('ログインするとトークンを保存してログイン状態にする', async () => {
    authApi.login.mockResolvedValue({ token: 'new-token', user: CURRENT_USER })
    renderProvider()

    await userEvent.click(screen.getByRole('button', { name: 'login' }))

    await waitFor(() => expect(status()).toHaveTextContent('authenticated'))
    expect(authApi.login).toHaveBeenCalledWith({ email: 'hanako@example.com', password: 'password123' })
    expect(tokenStorage.get()).toBe('new-token')
  })

  it('ログアウトするとトークンを消す', async () => {
    authApi.login.mockResolvedValue({ token: 'new-token', user: CURRENT_USER })
    renderProvider()
    await userEvent.click(screen.getByRole('button', { name: 'login' }))
    await waitFor(() => expect(status()).toHaveTextContent('authenticated'))

    await userEvent.click(screen.getByRole('button', { name: 'logout' }))

    expect(status()).toHaveTextContent('guest')
    expect(screen.getByTestId('user')).toHaveTextContent('なし')
    expect(tokenStorage.get()).toBeNull()
  })

  it('どのAPIでも401が返ったらログアウトする', async () => {
    tokenStorage.set('saved-token')
    authApi.me.mockResolvedValue(CURRENT_USER)
    renderProvider()
    await waitFor(() => expect(status()).toHaveTextContent('authenticated'))

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) }))
    await act(() => request('/api/timeline').catch(() => {}))

    expect(status()).toHaveTextContent('guest')
  })

  it('別のタブでログアウトしたら、このタブもログアウトする', async () => {
    tokenStorage.set('saved-token')
    authApi.me.mockResolvedValue(CURRENT_USER)
    renderProvider()
    await waitFor(() => expect(status()).toHaveTextContent('authenticated'))

    tokenStorage.clear()
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_STORAGE_KEY })))

    expect(status()).toHaveTextContent('guest')
  })

  it('updateUser で自分の情報の一部を書き換える', async () => {
    tokenStorage.set('saved-token')
    authApi.me.mockResolvedValue(CURRENT_USER)
    renderProvider()
    await waitFor(() => expect(status()).toHaveTextContent('authenticated'))

    await userEvent.click(screen.getByRole('button', { name: 'update' }))

    expect(screen.getByTestId('user')).toHaveTextContent('花子2')
  })

  it('AuthProvider の外で useAuth を使うとエラーにする', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow('useAuth は AuthProvider の中で使ってください')
  })
})
