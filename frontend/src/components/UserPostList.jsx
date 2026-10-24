import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js'
import { useUserPosts } from '../hooks/useUserPosts.js'
import { useAppLayout } from '../layout/useAppLayout.js'
import { PostCard } from './PostCard.jsx'

/**
 * プロフィール(SC-06)の投稿一覧。20件ずつ新しい順に無限スクロールで読み込む。
 * いいね・編集・削除は、タイムラインに出ている同じ投稿にも反映する。
 * 別のユーザーを開いたときに前の一覧を残さないよう、呼び出し側で key={username} を付ける。
 */
export function UserPostList({ username }) {
  const { timeline, openComposer } = useAppLayout()
  const { status, error, posts, hasNext, loadingMore, moreError, loadMore, updatePost, patchPost, removePost } =
    useUserPosts(username)

  const sentinelRef = useInfiniteScroll(loadMore, status === 'ready' && hasNext && !loadingMore && !moreError)

  // 編集の結果はタイムライン側には AppLayout が反映するので、ここではこの一覧だけを書き換える
  const handleEdit = (post) => openComposer(post, updatePost)

  const handleDeleted = (postId) => {
    removePost(postId)
    timeline.removePost(postId)
  }

  const handlePostChange = (postId, patch) => {
    patchPost(postId, patch)
    timeline.patchPost(postId, patch)
  }

  if (status === 'loading') return <p className="list-status">読み込み中…</p>
  if (status === 'error') return <p className="list-status">投稿を読み込めませんでした（{error}）</p>
  if (posts.length === 0) return <p className="list-status">まだ投稿がありません</p>

  return (
    <>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onEdit={handleEdit}
          onDeleted={handleDeleted}
          onPostChange={handlePostChange}
        />
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
      {!hasNext && <p className="list-status">これ以上投稿はありません</p>}
    </>
  )
}
