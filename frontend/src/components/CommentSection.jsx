import { useComments } from '../hooks/useComments.js'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js'
import { CommentForm } from './CommentForm.jsx'
import { CommentItem } from './CommentItem.jsx'

/**
 * 投稿詳細(SC-05)のコメント欄。入力欄と、古い順のコメント一覧(20件ずつ無限スクロール)。
 * コメントを追加・削除したら、onCountChange にサーバーが返した最新のコメント数を渡す。
 * 別の投稿を開いたときに前のコメントを残さないよう、呼び出し側で key={postId} を付ける。
 */
export function CommentSection({ postId, onCountChange }) {
  const { status, error, comments, hasNext, loadingMore, moreError, reload, loadMore, addComment, removeComment } =
    useComments(postId)

  const sentinelRef = useInfiniteScroll(loadMore, status === 'ready' && hasNext && !loadingMore && !moreError)

  const handleSubmit = async (content) => {
    const commentCount = await addComment(content)
    onCountChange(commentCount)
  }

  const handleDeleted = (commentId, commentCount) => {
    removeComment(commentId)
    if (commentCount != null) onCountChange(commentCount)
  }

  return (
    <section aria-label="コメント">
      <CommentForm onSubmit={handleSubmit} />

      {status === 'loading' && <p className="list-status">読み込み中…</p>}

      {status === 'error' && (
        <div className="list-status">
          <p>コメントを読み込めませんでした（{error}）</p>
          <button type="button" className="btn btn--outline" onClick={reload}>
            再読み込み
          </button>
        </div>
      )}

      {status === 'ready' && comments.length === 0 && <p className="list-status">まだコメントはありません</p>}

      {status === 'ready' &&
        comments.map((comment) => <CommentItem key={comment.id} comment={comment} onDeleted={handleDeleted} />)}

      {status === 'ready' && comments.length > 0 && (
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
        </>
      )}
    </section>
  )
}
