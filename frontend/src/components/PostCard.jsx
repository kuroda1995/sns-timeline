import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import * as postsApi from '../api/postsApi.js'
import { formatDateTime, formatRelativeTime } from '../utils/dateUtils.js'
import { Avatar } from './Avatar.jsx'

/**
 * 投稿カード(要件定義書 6-4)。タイムライン・投稿詳細で共通。
 * 編集・削除ボタンは自分の投稿(post.isMine)にだけ表示する。
 * 本文は React が文字としてそのまま表示するため、`<script>` もHTMLとして解釈されない。
 */
export function PostCard({ post, detail = false, onEdit, onDeleted }) {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const detailPath = `/posts/${post.id}`

  const handleCardClick = (e) => {
    if (detail) return
    // ボタン・リンクを押したとき、本文の文字を選択したときは移動しない
    if (e.target.closest('a, button')) return
    if (window.getSelection()?.toString()) return
    navigate(detailPath)
  }

  const handleDelete = async () => {
    if (!window.confirm('この投稿を削除しますか？この操作は取り消せません。')) return
    setDeleting(true)
    try {
      await postsApi.deletePost(post.id)
      onDeleted?.(post.id)
    } catch (err) {
      setDeleting(false)
      window.alert(err.message)
      // すでに削除されていた場合は、画面からも消す
      if (err.status === 404) onDeleted?.(post.id)
    }
  }

  const ownerButtons = post.isMine && (
    <div className="post-card__owner">
      <button
        type="button"
        className="icon-btn post-card__edit"
        aria-label="投稿を編集"
        title="編集"
        disabled={deleting}
        onClick={() => onEdit?.(post)}
      >
        ✏️
      </button>
      <button
        type="button"
        className="icon-btn post-card__delete"
        aria-label="投稿を削除"
        title="削除"
        disabled={deleting}
        onClick={handleDelete}
      >
        🗑
      </button>
    </div>
  )

  const actions = (
    <div className="post-actions">
      {detail ? (
        <span className="action-btn" aria-label={`コメント ${post.commentCount}件`}>
          <span className="action-btn__icon">💬</span>
          {post.commentCount}
        </span>
      ) : (
        <Link to={detailPath} className="action-btn action-btn--comment" aria-label={`コメント ${post.commentCount}件`}>
          <span className="action-btn__icon">💬</span>
          {post.commentCount}
        </Link>
      )}
      {/* いいね機能(LIKE)を実装するまでは件数の表示のみ */}
      <span className="action-btn" aria-label={`いいね ${post.likeCount}件`}>
        <span className="action-btn__icon">{post.likedByMe ? '♥' : '♡'}</span>
        {post.likeCount}
      </span>
    </div>
  )

  if (detail) {
    return (
      <article className="post-card is-detail">
        <div className="post-card__detail-head">
          <Avatar user={post.author} />
          <div className="post-card__detail-names">
            <span className="post-card__name">{post.author.displayName}</span>
            <span className="post-card__user">@{post.author.username}</span>
          </div>
          {ownerButtons}
        </div>
        <p className="post-card__content">{post.content}</p>
        <p className="post-card__datetime">
          <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time>
          {post.edited && <span className="post-card__edited"> ・ 編集済み</span>}
        </p>
        {actions}
      </article>
    )
  }

  return (
    <article className="post-card" onClick={handleCardClick}>
      <Avatar user={post.author} />
      <div className="post-card__body">
        <div className="post-card__head">
          <span className="post-card__name">{post.author.displayName}</span>
          <span className="post-card__user">@{post.author.username}</span>
          <span className="post-card__time">
            ・
            <Link to={detailPath} title={formatDateTime(post.createdAt)}>
              <time dateTime={post.createdAt}>{formatRelativeTime(post.createdAt)}</time>
            </Link>
          </span>
          {post.edited && <span className="post-card__edited">・編集済み</span>}
          {ownerButtons}
        </div>
        <p className="post-card__content">{post.content}</p>
        {actions}
      </div>
    </article>
  )
}
