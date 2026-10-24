import { useEffect, useState } from 'react'
import * as usersApi from '../api/usersApi.js'
import { UserRow } from './UserRow.jsx'

/** 検索する前の検索画面に出す「新しく参加したユーザー」(SRCH-04)。最大20人、自分は含まない */
export function NewUsers() {
  // { users, error } | null(読み込み中)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    usersApi
      .getNewUsers()
      .then((res) => {
        if (!cancelled) setResult({ users: res.items, error: null })
      })
      .catch((err) => {
        if (!cancelled) setResult({ users: [], error: err })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleFollowChange = (userId, followedByMe) => {
    setResult((r) => ({ ...r, users: r.users.map((u) => (u.id === userId ? { ...u, followedByMe } : u)) }))
  }

  let body
  if (!result) body = <p className="list-status">読み込み中…</p>
  else if (result.error) body = <p className="list-status">読み込めませんでした（{result.error.message}）</p>
  else if (result.users.length === 0) body = <p className="list-status">まだ他のユーザーはいません</p>
  else body = result.users.map((user) => <UserRow key={user.id} user={user} onFollowChange={handleFollowChange} />)

  return (
    <section aria-label="新しく参加したユーザー">
      <h2 className="section-title">新しく参加したユーザー</h2>
      {body}
    </section>
  )
}
