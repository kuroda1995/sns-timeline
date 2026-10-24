import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router'
import * as usersApi from '../api/usersApi.js'
import { FollowList } from '../components/FollowList.jsx'
import { followListPath, profilePath } from '../utils/paths.js'

/**
 * SC-08 フォロー中／フォロワー一覧(FLW-04)。URLの following／followers でタブを切り替える。
 * @param {{ kind: 'following' | 'followers' }} props
 */
export function FollowListPage({ kind }) {
  const { username } = useParams()
  const navigate = useNavigate()
  // ヘッダーに出す表示名と、ユーザーが存在するかの確認のためにプロフィールを読み込む
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    usersApi
      .getProfile(username)
      .then((profile) => {
        if (!cancelled) setResult({ username, profile, error: null })
      })
      .catch((err) => {
        if (!cancelled) setResult({ username, profile: null, error: err })
      })
    return () => {
      cancelled = true
    }
  }, [username])

  // タブを切り替えたときは一番上から表示する
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [username, kind])

  const loaded = result?.username === username ? result : null
  const profile = loaded?.profile

  const goBack = () => {
    // このアプリ内から開いた場合は前の画面へ、URLを直接開いた場合はプロフィールへ
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(profilePath(username))
  }

  const tabClass = ({ isActive }) => `tabs__tab${isActive ? ' is-active' : ''}`

  let body
  if (!loaded) {
    body = <p className="list-status">読み込み中…</p>
  } else if (loaded.error) {
    body = (
      <div className="notice">
        <strong>{loaded.error.status === 404 ? 'このアカウントは存在しません' : '読み込めませんでした'}</strong>
        {loaded.error.status !== 404 && <p>{loaded.error.message}</p>}
      </div>
    )
  } else {
    body = (
      <FollowList
        key={`${profile.username}/${kind}`}
        username={profile.username}
        kind={kind}
      />
    )
  }

  return (
    <>
      <header className="page-header page-header--tabs">
        <div className="page-header__row">
          <button type="button" className="icon-btn" aria-label="戻る" onClick={goBack}>
            ←
          </button>
          <div className="page-header__titles">
            <h1>{profile?.displayName ?? 'フォロー'}</h1>
            {profile && <p className="page-header__sub">@{profile.username}</p>}
          </div>
        </div>
        {profile && (
          <nav className="tabs" aria-label="一覧の切り替え">
            <NavLink to={followListPath(profile.username, 'following')} replace className={tabClass}>
              フォロー中
            </NavLink>
            <NavLink to={followListPath(profile.username, 'followers')} replace className={tabClass}>
              フォロワー
            </NavLink>
          </nav>
        )}
      </header>
      {body}
    </>
  )
}
