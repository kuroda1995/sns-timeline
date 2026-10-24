import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js'
import { useUserSearch } from '../hooks/useUserSearch.js'
import { UserRow } from './UserRow.jsx'

/**
 * ユーザー検索の結果(SRCH-01・02)。見出しに件数(21件以上なら「20件以上」)、20件ずつ無限スクロール。
 * キーワードが変わったときに前の結果を残さないよう、呼び出し側で key={q} を付ける。
 */
export function UserSearchResults({ q }) {
  const { status, error, users, hasNext, moreThanFirstPage, loadingMore, moreError, loadMore, setFollowedByMe } =
    useUserSearch(q)

  const sentinelRef = useInfiniteScroll(loadMore, status === 'ready' && hasNext && !loadingMore && !moreError)

  if (status === 'loading') return <p className="list-status">検索中…</p>
  if (status === 'error') return <p className="list-status">検索できませんでした（{error}）</p>
  if (users.length === 0) return <p className="list-status">「{q}」に一致するユーザーは見つかりませんでした</p>

  return (
    <section aria-label="検索結果">
      <h2 className="section-title">
        「{q}」の検索結果（{moreThanFirstPage ? '20件以上' : `${users.length}件`}）
      </h2>
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
    </section>
  )
}
