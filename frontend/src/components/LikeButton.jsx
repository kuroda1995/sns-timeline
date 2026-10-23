import { useEffect, useRef } from 'react'
import * as postsApi from '../api/postsApi.js'

/**
 * いいねボタン(LIKE-01〜04)。押したらサーバーの返事を待たずに表示を切り替え(楽観的更新)、
 * 返ってきた最新のいいね数で上書きする。失敗したら元の表示に戻す。
 * 通信中に連打された場合は、最後に押した状態になるまで1件ずつ送る(同時にリクエストを出さない)。
 *
 * @param {{ post: object, onChange: (postId: number, patch: { likeCount: number, likedByMe: boolean }) => void }} props
 */
export function LikeButton({ post, onChange }) {
  // サーバーで確定している状態。失敗したときはここに戻す
  const confirmedRef = useRef(null)
  // 最後に押した結果、なってほしい状態
  const wantedRef = useRef(post.likedByMe)
  const syncingRef = useRef(false)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  const sync = async () => {
    syncingRef.current = true
    try {
      while (wantedRef.current !== confirmedRef.current.likedByMe) {
        confirmedRef.current = wantedRef.current
          ? await postsApi.likePost(post.id)
          : await postsApi.unlikePost(post.id)
      }
      onChangeRef.current(post.id, confirmedRef.current)
    } catch {
      wantedRef.current = confirmedRef.current.likedByMe
      onChangeRef.current(post.id, confirmedRef.current)
      window.alert('いいねできませんでした')
    } finally {
      syncingRef.current = false
    }
  }

  const handleClick = () => {
    if (!syncingRef.current) {
      confirmedRef.current = { likeCount: post.likeCount, likedByMe: post.likedByMe }
      wantedRef.current = post.likedByMe
    }
    const next = !wantedRef.current
    wantedRef.current = next
    const confirmed = confirmedRef.current
    const diff = next === confirmed.likedByMe ? 0 : next ? 1 : -1
    onChangeRef.current(post.id, { likedByMe: next, likeCount: Math.max(0, confirmed.likeCount + diff) })
    if (!syncingRef.current) sync()
  }

  return (
    <button
      type="button"
      className={`action-btn action-btn--like${post.likedByMe ? ' is-liked' : ''}`}
      aria-pressed={post.likedByMe}
      aria-label={`いいね ${post.likeCount}件`}
      onClick={handleClick}
    >
      <span className="action-btn__icon" aria-hidden="true">
        {post.likedByMe ? '♥' : '♡'}
      </span>
      {/* いいね数が0のときは数字を表示しない */}
      {post.likeCount > 0 && post.likeCount}
    </button>
  )
}
