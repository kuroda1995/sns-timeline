import { useCallback, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import { Avatar } from '../components/Avatar.jsx'
import { PostComposerModal } from '../components/PostComposerModal.jsx'
import { useTimeline } from '../hooks/useTimeline.js'
import { AppLayoutContext } from './AppLayoutContext.js'

/**
 * ログイン後の共通レイアウト(要件定義書 6-3)。左にサイドメニュー、中央に各画面を表示する。
 * 投稿作成モーダル(SC-04)とタイムラインの状態もここで持ち、どの画面からでも使えるようにする。
 * 検索・プロフィールのメニューは、それぞれの画面を実装するときに追加する。
 */
export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const timeline = useTimeline()
  // { editingPost, onSaved } | null
  const [composer, setComposer] = useState(null)

  const openComposer = useCallback((editingPost = null, onSaved = null) => {
    setComposer({ editingPost, onSaved })
  }, [])

  const handleSaved = (saved) => {
    const { editingPost, onSaved } = composer
    setComposer(null)
    if (editingPost) {
      timeline.updatePost(saved)
    } else {
      // 投稿したら、タイムラインの一番上に自分の投稿を表示する
      timeline.prependPost(saved)
      if (location.pathname !== '/') navigate('/')
      window.scrollTo({ top: 0 })
    }
    onSaved?.(saved)
  }

  // ホームを表示中にもう一度「ホーム」を押したら、最新の投稿を読み込み直す(TL-05)
  const handleHomeClick = () => {
    if (location.pathname !== '/') return
    timeline.reload()
    window.scrollTo({ top: 0 })
  }

  const handleLogout = () => {
    // 確認ダイアログは出さない(認証機能.md「ログアウト」)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <AppLayoutContext.Provider value={{ timeline, openComposer }}>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar__logo">SNS TimeLine</div>
          <nav className="sidebar__nav" aria-label="メニュー">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
              onClick={handleHomeClick}
            >
              <span className="nav-link__icon" aria-hidden="true">🏠</span>
              <span className="nav-link__text">ホーム</span>
            </NavLink>
          </nav>
          <div className="sidebar__post">
            <button type="button" className="btn btn--primary btn--large" onClick={() => openComposer()}>
              投稿する
            </button>
          </div>
          <div className="sidebar__me">
            <div className="sidebar__me-link">
              <Avatar user={user} />
              <div className="sidebar__me-text">
                <div className="sidebar__me-name">{user.displayName}</div>
                <div className="sidebar__me-user">@{user.username}</div>
              </div>
            </div>
            <button type="button" className="btn btn--outline btn--block" onClick={handleLogout}>
              ログアウト
            </button>
          </div>
        </aside>

        <main className="main">
          <Outlet />
        </main>

        {/* スマートフォン幅のときだけ表示する */}
        <nav className="bottom-nav" aria-label="メニュー(スマートフォン)">
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? 'is-active' : undefined)}
            aria-label="ホーム"
            onClick={handleHomeClick}
          >
            🏠
          </NavLink>
          <button type="button" aria-label="ログアウト" onClick={handleLogout}>
            🚪
          </button>
        </nav>
        <button type="button" className="fab" aria-label="投稿する" onClick={() => openComposer()}>
          ✏️
        </button>
      </div>

      {composer && (
        <PostComposerModal
          editingPost={composer.editingPost}
          onClose={() => setComposer(null)}
          onSaved={handleSaved}
        />
      )}
    </AppLayoutContext.Provider>
  )
}
