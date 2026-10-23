import { useState } from 'react'
import * as commentsApi from '../api/commentsApi.js'
import { formatDateTime, formatRelativeTime } from '../utils/dateUtils.js'
import { Avatar } from './Avatar.jsx'

/**
 * コメント1件(CMT-02・03)。🗑 は自分のコメント(comment.isMine)にだけ表示する。
 * 本文は React が文字としてそのまま表示するため、HTMLとして解釈されない。
 * onDeleted(commentId, commentCount) は削除できたときに呼ばれる(すでに削除済みだった場合 commentCount は null)。
 */
export function CommentItem({ comment, onDeleted }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm('このコメントを削除しますか？この操作は取り消せません。')) return
    setDeleting(true)
    try {
      const { commentCount } = await commentsApi.deleteComment(comment.id)
      onDeleted(comment.id, commentCount)
    } catch (err) {
      setDeleting(false)
      window.alert(err.message)
      // すでに削除されていた場合は、画面からも消す
      if (err.status === 404) onDeleted(comment.id, null)
    }
  }

  return (
    <article className="comment">
      <Avatar user={comment.author} />
      <div className="post-card__body">
        <div className="post-card__head">
          <span className="post-card__name">{comment.author.displayName}</span>
          <span className="post-card__user">@{comment.author.username}</span>
          <span className="post-card__time">
            ・
            <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)}>
              {formatRelativeTime(comment.createdAt)}
            </time>
          </span>
          {comment.isMine && (
            <div className="post-card__owner">
              <button
                type="button"
                className="icon-btn post-card__delete"
                aria-label="コメントを削除"
                title="削除"
                disabled={deleting}
                onClick={handleDelete}
              >
                🗑
              </button>
            </div>
          )}
        </div>
        <p className="post-card__content">{comment.content}</p>
      </div>
    </article>
  )
}
