// ログイン状態で画面の出し分けをする RequireAuth・GuestOnly のテスト
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/AuthContext.js'
import { createAuth } from '../test/render.jsx'
import { GuestOnly } from './GuestOnly.jsx'
import { RequireAuth } from './RequireAuth.jsx'

function LoginScreen() {
  const location = useLocation()
  return <p>ログイン画面(戻り先: {location.state?.from?.pathname ?? 'なし'})</p>
}

/** 画面と同じルート構成(ログイン必須の画面と、ログインしていない人向けの画面)で表示する */
function renderRoutes(status, { route, state } = {}) {
  render(
    <AuthContext.Provider value={createAuth({ status })}>
      <MemoryRouter initialEntries={[{ pathname: route, state }]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>ホーム</p>} />
            <Route path="/posts/:id" element={<p>投稿詳細</p>} />
          </Route>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginScreen />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuth', () => {
  it('ログイン済みなら画面を表示する', () => {
    renderRoutes('authenticated', { route: '/posts/1' })

    expect(screen.getByText('投稿詳細')).toBeInTheDocument()
  })

  it('ログインしていなければ、開こうとした画面を覚えてログイン画面へ移動する', () => {
    renderRoutes('guest', { route: '/posts/1' })

    expect(screen.getByText('ログイン画面(戻り先: /posts/1)')).toBeInTheDocument()
  })

  it('確認中は読み込み中を表示する', () => {
    renderRoutes('loading', { route: '/' })

    expect(screen.getByText('読み込み中…')).toBeInTheDocument()
  })

  it('ログイン情報を確認できなければ、再読み込みを案内する', () => {
    renderRoutes('error', { route: '/' })

    expect(screen.getByRole('alert')).toHaveTextContent('サーバーに接続できませんでした')
    expect(screen.queryByText('ホーム')).not.toBeInTheDocument()
  })
})

describe('GuestOnly', () => {
  it('ログインしていなければログイン画面を表示する', () => {
    renderRoutes('guest', { route: '/login' })

    expect(screen.getByText(/ログイン画面/)).toBeInTheDocument()
  })

  it('ログイン済みならホームへ移動する', () => {
    renderRoutes('authenticated', { route: '/login' })

    expect(screen.getByText('ホーム')).toBeInTheDocument()
  })

  it('ログイン直後は、ログイン前に開こうとしていた画面へ戻す', () => {
    renderRoutes('authenticated', { route: '/login', state: { from: { pathname: '/posts/1' } } })

    expect(screen.getByText('投稿詳細')).toBeInTheDocument()
  })

  it('確認中・確認できないときはログイン画面を出さない', () => {
    renderRoutes('error', { route: '/login' })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/ログイン画面/)).not.toBeInTheDocument()
  })
})
