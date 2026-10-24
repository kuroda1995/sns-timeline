import { useFollowList } from '../hooks/useFollowList.js'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js'
import { UserRow } from './UserRow.jsx'

const EMPTY_MESSAGES = {
  following: 'まだ誰もフォローしていません',
  followers: 'まだフォロワーはいません',
}

/**
 * フォロー中／フォロワーの一覧(SC-08)。20件ずつ無限スクロールで読み込む。
 * ユーザーやタブが変わったときに前の一覧を残さないよう、呼び出し側で key を付ける。
 * @param {{ username: string, kind: 'following' | 'followers' }} props
 */
export function FollowList({ username, kind }) {
  const { status, error, users, hasNext, loadingMore, moreError, loadMore, setFollowedByMe } =
    useFollowList(username, kind)

  const sentinelRef = useInfiniteScroll(loadMore, status === 'ready' && hasNext && !loadingMore && !moreError)

  if (status === 'loading') return <p className="list-status">読み込み中…</p>
  if (status === 'error') return <p className="list-status">一覧を読み込めませんでした（{error}）</p>
  if (users.length === 0) return <p className="list-status">{EMPTY_MESSAGES[kind]}</p>

  return (
    <>
      {users.map((user) => (
        <UserRow key={user.id} user={user} onFollowChange={setFollowedByMe} />
      ))}
      <div ref={sentinelRef} className="sentinel" />
      {loadingMore && <p className="list-status">読み込み中…</p>}
      {moreError && (
        <div className="list-status">
          <p>{moreError}</p>
          <button type="button" className="btn btn--outline" onClick={loadMore}>
            もう一度読み込む
          </button>
        </div>
      )}
    </>
  )
}
