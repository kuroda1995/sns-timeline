import { useState } from 'react'
import * as usersApi from '../api/usersApi.js'
import { useAppLayout } from '../layout/useAppLayout.js'

/**
 * フォローボタン(FLW-01・02)。プロフィール・フォロー中／フォロワー一覧で共通。
 * 押したらサーバーの返事を待たずに表示を切り替え(楽観的更新)、失敗したら元に戻す。通信中は押せない。
 * フォロー中のボタンにマウスを乗せると「フォロー解除」になり、解除するときだけ確認ダイアログを出す。
 *
 * onChange(followedByMe, followerCount) は表示を切り替えるたびに呼ばれる。
 * followerCount はサーバーが返した相手の最新のフォロワー数で、楽観的更新・元に戻すときは null。
 */
export function FollowButton({ username, followedByMe, onChange }) {
  const { timeline } = useAppLayout()
  const [pending, setPending] = useState(false)

  const handleClick = async () => {
    if (followedByMe && !window.confirm(`@${username} さんのフォローを解除しますか？`)) return
    const next = !followedByMe
    setPending(true)
    onChange(next, null)
    try {
      const res = next ? await usersApi.follow(username) : await usersApi.unfollow(username)
      onChange(res.followedByMe, res.followerCount)
      // フォローした人の投稿は、次にタイムラインを開いたときに表示する(表示中の一覧からはすぐには消さない)
      timeline.invalidate()
    } catch {
      onChange(followedByMe, null)
      window.alert(next ? 'フォローできませんでした' : 'フォロー解除できませんでした')
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      className={`btn follow-btn ${followedByMe ? 'btn--outline is-following' : 'btn--primary'}`}
      disabled={pending}
      onClick={handleClick}
    >
      {followedByMe ? (
        <>
          <span className="follow-btn__default">フォロー中</span>
          <span className="follow-btn__hover">フォロー解除</span>
        </>
      ) : (
        'フォローする'
      )}
    </button>
  )
}
