import { useEffect, useLayoutEffect, useState } from 'react'
import { useNavigationType } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import { Avatar } from '../components/Avatar.jsx'
import { EmptyTimeline } from '../components/EmptyTimeline.jsx'
import { PostCard } from '../components/PostCard.jsx'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js'
import { useNewPostsPolling } from '../hooks/useNewPostsPolling.js'
import { useAppLayout } from '../layout/useAppLayout.js'

/** 「3分前」の表示を更新する間隔 */
const RELATIVE_TIME_REFRESH_MS = 60_000

/** SC-03 タイムライン(TL-01〜05) */
export function TimelinePage() {
  const { user } = useAuth()
  const { timeline, openComposer } = useAppLayout()
  const navigationType = useNavigationType()
  const {
    status,
    error,
    posts,
    hasNext,
    loadingMore,
    moreError,
    pending,
    pendingHasMore,
    scrollYRef,
    reload,
    loadMore,
    checkNew,
    flushPending,
    removePost,
  } = timeline

  // 初めて開いたときだけ読み込む。投稿詳細から戻ってきたときは、読み込み済みの一覧をそのまま使う
  useEffect(() => {
    if (status === 'idle') reload()
  }, [status, reload])

  // 「戻る」で戻ってきたときは元のスクロール位置に、それ以外は一番上から表示する
  useLayoutEffect(() => {
    window.scrollTo(0, navigationType === 'POP' ? scrollYRef.current : 0)
    return () => {
      scrollYRef.current = window.scrollY
    }
  }, [navigationType, scrollYRef])

  const [, setNow] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RELATIVE_TIME_REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  const hasPending = pending.length > 0 || pendingHasMore
  useNewPostsPolling({ enabled: status === 'ready', hasPending, checkNew, flushPending })

  const sentinelRef = useInfiniteScroll(loadMore, status === 'ready' && hasNext && !loadingMore && !moreError)

  const showNewPosts = () => {
    flushPending()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <header className="page-header">
        <h1>ホーム</h1>
      </header>

      <div className="compose-prompt">
        <Avatar user={user} />
        <button type="button" className="compose-prompt__input" onClick={() => openComposer()}>
          いまどうしてる？
        </button>
        <button type="button" className="btn btn--primary" onClick={() => openComposer()}>
          投稿する
        </button>
      </div>

      {hasPending && (
        <div className="new-posts">
          <button type="button" className="btn btn--primary new-posts__btn" onClick={showNewPosts}>
            ↑ 新しい投稿 {pendingHasMore ? '20件以上' : `${pending.length}件`}
          </button>
        </div>
      )}

      {status === 'loading' && <p className="list-status">読み込み中…</p>}

      {status === 'error' && (
        <div className="notice">
          <strong>タイムラインを読み込めませんでした</strong>
          <p>{error}</p>
          <button type="button" className="btn btn--outline" onClick={reload}>
            再読み込み
          </button>
        </div>
      )}

      {status === 'ready' && posts.length === 0 && <EmptyTimeline onCompose={() => openComposer()} />}

      {status === 'ready' &&
        posts.map((post) => (
          <PostCard key={post.id} post={post} onEdit={openComposer} onDeleted={removePost} />
        ))}

      {status === 'ready' && posts.length > 0 && (
        <>
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
          {!hasNext && <p className="list-status">これ以上投稿はありません</p>}
        </>
      )}
    </>
  )
}
