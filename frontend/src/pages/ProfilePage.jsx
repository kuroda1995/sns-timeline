import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import * as usersApi from '../api/usersApi.js'
import { ProfileHeader } from '../components/ProfileHeader.jsx'
import { UserPostList } from '../components/UserPostList.jsx'

/** SC-06 プロフィール(USER-01)。ユーザーの情報と、そのユーザーの投稿一覧 */
export function ProfilePage() {
  const { username } = useParams()
  const navigate = useNavigate()
  // { username, profile, error } の形で、どのユーザーを読み込んだ結果かを持つ
  const [result, setResult] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
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

  const loaded = result?.username === username ? result : null

  const goBack = () => {
    // このアプリ内から開いた場合は前の画面へ、URLを直接開いた場合はタイムラインへ
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/')
  }

  let title = ''
  let body
  if (!loaded) {
    body = <p className="list-status">読み込み中…</p>
  } else if (loaded.error) {
    body = (
      <div className="notice">
        <strong>{loaded.error.status === 404 ? 'このアカウントは存在しません' : 'プロフィールを読み込めませんでした'}</strong>
        {loaded.error.status !== 404 && <p>{loaded.error.message}</p>}
      </div>
    )
  } else {
    title = loaded.profile.displayName
    body = (
      <>
        <ProfileHeader profile={loaded.profile} />
        {/* /users/Taro と /users/taro は同じユーザーなので、正式なユーザー名で一覧を持つ */}
        <UserPostList key={loaded.profile.username} username={loaded.profile.username} />
      </>
    )
  }

  return (
    <>
      <header className="page-header">
        <button type="button" className="icon-btn" aria-label="戻る" onClick={goBack}>
          ←
        </button>
        <h1>{title || 'プロフィール'}</h1>
      </header>
      {body}
    </>
  )
}
