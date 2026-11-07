// ログイン画面(SC-01)・新規登録画面(SC-02)のテスト
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/http.js'
import { deferred } from '../test/fixtures.js'
import { createAuth, renderWithProviders } from '../test/render.jsx'
import { LoginPage } from './LoginPage.jsx'
import { SignupPage } from './SignupPage.jsx'

describe('LoginPage', () => {
  function renderLogin(login = vi.fn().mockResolvedValue()) {
    return renderWithProviders(<LoginPage />, { auth: createAuth({ status: 'guest', login }) })
  }

  it('未入力で送信すると、サーバーに送らずに項目ごとのエラーを表示する', async () => {
    const { auth } = renderLogin()

    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(screen.getByLabelText('メールアドレス')).toHaveAccessibleDescription('メールアドレスを入力してください')
    expect(screen.getByLabelText('パスワード')).toHaveAccessibleDescription('パスワードを入力してください')
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('直し始めた欄のエラーだけを消す', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'h')

    expect(screen.getByLabelText('メールアドレス')).not.toHaveAccessibleDescription()
    expect(screen.getByLabelText('パスワード')).toHaveAccessibleDescription('パスワードを入力してください')
  })

  it('前後の空白を取り除いたメールアドレスでログインし、通信中は押せない', async () => {
    const req = deferred()
    const { auth } = renderLogin(vi.fn(() => req.promise))

    await userEvent.type(screen.getByLabelText('メールアドレス'), ' hanako@example.com ')
    await userEvent.type(screen.getByLabelText('パスワード'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(auth.login).toHaveBeenCalledWith({ email: 'hanako@example.com', password: 'password123' })
    expect(screen.getByRole('button', { name: 'ログイン中…' })).toBeDisabled()
    req.resolve()
  })

  it('ログインできなければサーバーのメッセージを表示し、もう一度押せるようにする', async () => {
    renderLogin(vi.fn().mockRejectedValue(new ApiError(401, 'メールアドレスまたはパスワードが違います')))

    await userEvent.type(screen.getByLabelText('メールアドレス'), 'hanako@example.com')
    await userEvent.type(screen.getByLabelText('パスワード'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('メールアドレスまたはパスワードが違います')
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeEnabled()
  })

  it('新規登録画面へのリンクがある', () => {
    renderLogin()

    expect(screen.getByRole('link', { name: '新規登録' })).toHaveAttribute('href', '/signup')
  })
})

describe('SignupPage', () => {
  function renderSignup(signup = vi.fn().mockResolvedValue()) {
    return renderWithProviders(<SignupPage />, { auth: createAuth({ status: 'guest', signup }) })
  }

  async function fillForm(overrides = {}) {
    const values = {
      ユーザー名: 'hanako',
      表示名: ' 花子 ',
      メールアドレス: ' hanako@example.com ',
      パスワード: 'password123',
      'パスワード(確認)': 'password123',
      ...overrides,
    }
    for (const [label, value] of Object.entries(values)) {
      if (value) await userEvent.type(screen.getByLabelText(label), value)
    }
  }

  it('入力内容を整えて登録する', async () => {
    const { auth } = renderSignup()

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    expect(auth.signup).toHaveBeenCalledWith({
      username: 'hanako',
      displayName: '花子',
      email: 'hanako@example.com',
      password: 'password123',
    })
  })

  it('入力チェックに引っかかればサーバーに送らない', async () => {
    const { auth } = renderSignup()

    await fillForm({ ユーザー名: 'ab', 'パスワード(確認)': 'password124' })
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    expect(screen.getByLabelText('ユーザー名')).toHaveAccessibleDescription('3〜15文字で入力してください')
    expect(screen.getByLabelText('パスワード(確認)')).toHaveAccessibleDescription('パスワードが一致しません')
    expect(auth.signup).not.toHaveBeenCalled()
  })

  it('パスワードを直したら、確認欄の「一致しません」も消す', async () => {
    renderSignup()
    await fillForm({ 'パスワード(確認)': 'password124' })
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    await userEvent.type(screen.getByLabelText('パスワード'), '4')

    expect(screen.getByLabelText('パスワード(確認)')).not.toHaveAccessibleDescription()
  })

  it('サーバーの項目ごとのエラー(使用済みのユーザー名など)はその欄に表示する', async () => {
    renderSignup(
      vi.fn().mockRejectedValue(
        new ApiError(409, '既に使われています', [{ field: 'username', message: 'このユーザー名は既に使われています' }]),
      ),
    )

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() =>
      expect(screen.getByLabelText('ユーザー名')).toHaveAccessibleDescription('このユーザー名は既に使われています'),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('項目ごとのエラーが無い失敗(サーバーに繋がらない等)は上にまとめて表示する', async () => {
    renderSignup(vi.fn().mockRejectedValue(new ApiError(0, 'サーバーに接続できませんでした')))

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('サーバーに接続できませんでした')
    expect(screen.getByRole('button', { name: '登録する' })).toBeEnabled()
  })
})
