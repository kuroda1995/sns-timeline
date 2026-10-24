import { request } from './http.js'

/** U-03 プロフィール → Profile */
export function getProfile(username) {
  return request(`/api/users/${encodeURIComponent(username)}`)
}

/** U-04 ユーザーの投稿一覧 → { items, nextCursor, hasNext }。cursor を省略すると最新から */
export function getUserPosts(username, cursor) {
  const query = cursor == null ? '' : `?cursor=${encodeURIComponent(cursor)}`
  return request(`/api/users/${encodeURIComponent(username)}/posts${query}`)
}

/** F-01 フォローする → { followedByMe, followerCount } */
export function follow(username) {
  return request(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'POST' })
}

/** F-02 フォロー解除 → { followedByMe, followerCount } */
export function unfollow(username) {
  return request(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' })
}

/**
 * F-03 フォロー中の一覧 / F-04 フォロワーの一覧 → { items, nextCursor, hasNext }
 * @param {'following' | 'followers'} kind
 */
export function getFollowList(username, kind, cursor) {
  const query = cursor == null ? '' : `?cursor=${encodeURIComponent(cursor)}`
  return request(`/api/users/${encodeURIComponent(username)}/${kind}${query}`)
}

/** U-05 プロフィール更新(ログイン中のユーザー自身のみ) → Profile */
export function updateProfile({ displayName, bio }) {
  return request('/api/users/me', { method: 'PUT', body: { displayName, bio } })
}
