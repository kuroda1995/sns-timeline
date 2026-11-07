// コンポーネントを、画面と同じ Context(ログイン情報・共通レイアウト・ルーター)の中で表示する
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext.js'
import { AppLayoutContext } from '../layout/AppLayoutContext.js'
import { CURRENT_USER } from './fixtures.js'
import { LocationDisplay } from './LocationDisplay.jsx'

export function createAuth(overrides = {}) {
  return {
    user: CURRENT_USER,
    status: 'authenticated',
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  }
}

export function createLayout() {
  return {
    timeline: { invalidate: vi.fn(), removePost: vi.fn(), patchPost: vi.fn() },
    openComposer: vi.fn(),
  }
}

/**
 * @param {import('react').ReactNode} ui
 * @param {{ auth?: object, layout?: object, route?: string, path?: string }} options
 *   route: 最初に開くURL。path: ui を表示するルートのパターン(ルートの外へ移動したら LocationDisplay を表示する)
 */
export function renderWithProviders(ui, { auth = createAuth(), layout = createLayout(), route = '/', path = '/' } = {}) {
  const result = render(
    <AuthContext.Provider value={auth}>
      <AppLayoutContext.Provider value={layout}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="*" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      </AppLayoutContext.Provider>
    </AuthContext.Provider>,
  )
  return { ...result, auth, layout }
}
