import { Link } from 'react-router'
import { followListPath } from '../utils/paths.js'
import { Avatar } from './Avatar.jsx'
import { FollowButton } from './FollowButton.jsx'

/** 「2026年10月から利用しています」 */
function formatJoined(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月から利用しています`
}

/**
 * プロフィール(SC-06)の上部。アイコン・名前・自己紹介・登録月・フォロー数・フォロワー数。
 * 自分のプロフィールなら「プロフィール編集」ボタン(処理のルール No.6)、他人ならフォローボタンを表示する。
 * onFollowChange(followedByMe, followerCount) はフォローボタンの状態が変わったときに呼ばれる
 * (followerCount はサーバーの最新値。楽観的更新のときは null)。
 */
export function ProfileHeader({ profile, onFollowChange }) {
  return (
    <section className="profile" aria-label="プロフィール">
      <div className="profile__top">
        <Avatar user={profile} size="large" />
        {profile.isMe ? (
          <Link to="/settings/profile" className="btn btn--outline">
            プロフィール編集
          </Link>
        ) : (
          <FollowButton username={profile.username} followedByMe={profile.followedByMe} onChange={onFollowChange} />
        )}
      </div>
      <h2 className="profile__name">{profile.displayName}</h2>
      <p className="profile__user">@{profile.username}</p>
      {/* 自己紹介は改行を反映して表示する。空なら何も表示しない */}
      {profile.bio && <p className="profile__bio">{profile.bio}</p>}
      <p className="profile__joined">📅 {formatJoined(profile.createdAt)}</p>
      <p className="profile__counts">
        <Link to={followListPath(profile.username, 'following')}>
          <strong>{profile.followingCount}</strong> フォロー中
        </Link>
        <Link to={followListPath(profile.username, 'followers')}>
          <strong>{profile.followerCount}</strong> フォロワー
        </Link>
      </p>
    </section>
  )
}
