import { Link } from 'react-router'
import { Avatar } from './Avatar.jsx'

/** 「2026年10月から利用しています」 */
function formatJoined(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月から利用しています`
}

/**
 * プロフィール(SC-06)の上部。アイコン・名前・自己紹介・登録月・フォロー数・フォロワー数。
 * 自分のプロフィールなら「プロフィール編集」ボタンを表示する(処理のルール No.6)。
 * 他人のプロフィールのフォローボタンはフォロー機能(FLW)で追加する。
 */
export function ProfileHeader({ profile }) {
  return (
    <section className="profile" aria-label="プロフィール">
      <div className="profile__top">
        <Avatar user={profile} size="large" />
        {profile.isMe && (
          <Link to="/settings/profile" className="btn btn--outline">
            プロフィール編集
          </Link>
        )}
      </div>
      <h2 className="profile__name">{profile.displayName}</h2>
      <p className="profile__user">@{profile.username}</p>
      {/* 自己紹介は改行を反映して表示する。空なら何も表示しない */}
      {profile.bio && <p className="profile__bio">{profile.bio}</p>}
      <p className="profile__joined">📅 {formatJoined(profile.createdAt)}</p>
      <p className="profile__counts">
        <span>
          <strong>{profile.followingCount}</strong> フォロー中
        </span>
        <span>
          <strong>{profile.followerCount}</strong> フォロワー
        </span>
      </p>
    </section>
  )
}
