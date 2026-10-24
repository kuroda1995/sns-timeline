import { Avatar } from './Avatar.jsx'
import { FollowButton } from './FollowButton.jsx'
import { UserLink } from './UserLink.jsx'

/**
 * ユーザー1行(アイコン・表示名・@ユーザー名・自己紹介の1行目・フォローボタン)。
 * フォロー中／フォロワー一覧・ユーザー検索の結果・新しく参加したユーザーで使う。
 * フォローボタンは「ログイン中の自分が」その人をフォローしているかを表す。自分自身の行にはボタンの代わりに「あなた」と表示する。
 *
 * onFollowChange(userId, followedByMe) はフォローの状態が変わったときに呼ばれる。
 */
export function UserRow({ user, onFollowChange }) {
  return (
    <article className="user-row">
      {/* 表示名のリンクと同じ移動先のため、キーボード操作・読み上げでは飛ばす */}
      <UserLink username={user.username} tabIndex={-1} aria-hidden="true">
        <Avatar user={user} />
      </UserLink>
      <div className="user-row__body">
        <div className="user-row__head">
          <div className="user-row__names">
            <UserLink username={user.username} className="post-card__name">
              {user.displayName}
            </UserLink>
            <UserLink username={user.username} className="post-card__user">
              @{user.username}
            </UserLink>
          </div>
          {user.isMe ? (
            <span className="user-row__me">あなた</span>
          ) : (
            <FollowButton
              username={user.username}
              followedByMe={user.followedByMe}
              onChange={(followedByMe) => onFollowChange(user.id, followedByMe)}
            />
          )}
        </div>
        {/* 自己紹介は1行目だけを表示し、長い場合は「…」で省略する */}
        {user.bio && <p className="user-row__bio">{user.bio.split('\n')[0]}</p>}
      </div>
    </article>
  )
}
