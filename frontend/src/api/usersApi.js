import { request } from './http.js'

/** @typedef {import('./types.js').UserSearchResult} UserSearchResult */
/** @typedef {import('./types.js').UserList} UserList */
/** @typedef {import('./types.js').Profile} Profile */
/** @typedef {import('./types.js').PostPage} PostPage */
/** @typedef {import('./types.js').FollowResult} FollowResult */
/** @typedef {import('./types.js').UserSummaryPage} UserSummaryPage */
/** @typedef {import('./types.js').AvatarResult} AvatarResult */

/**
 * U-01 ユーザー検索 → { items, page, hasNext }。q の先頭が @ ならユーザー名だけを検索する。page は0始まり
 * @returns {Promise<UserSearchResult>}
 */
export function searchUsers(q, page = 0) {
  return request(`/api/users/search?q=${encodeURIComponent(q)}&page=${page}`)
}

/**
 * U-02 新しく参加したユーザー → { items }
 * @returns {Promise<UserList>}
 */
export function getNewUsers() {
  return request('/api/users/new')
}

/**
 * U-03 プロフィール → Profile
 * @returns {Promise<Profile>}
 */
export function getProfile(username) {
  return request(`/api/users/${encodeURIComponent(username)}`)
}

/**
 * U-04 ユーザーの投稿一覧 → { items, nextCursor, hasNext }。cursor を省略すると最新から
 * @returns {Promise<PostPage>}
 */
export function getUserPosts(username, cursor) {
  const query = cursor == null ? '' : `?cursor=${encodeURIComponent(cursor)}`
  return request(`/api/users/${encodeURIComponent(username)}/posts${query}`)
}

/**
 * F-01 フォローする → { followedByMe, followerCount }
 * @returns {Promise<FollowResult>}
 */
export function follow(username) {
  return request(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'POST' })
}

/**
 * F-02 フォロー解除 → { followedByMe, followerCount }
 * @returns {Promise<FollowResult>}
 */
export function unfollow(username) {
  return request(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' })
}

/**
 * F-03 フォロー中の一覧 / F-04 フォロワーの一覧 → { items, nextCursor, hasNext }
 * @param {'following' | 'followers'} kind
 * @returns {Promise<UserSummaryPage>}
 */
export function getFollowList(username, kind, cursor) {
  const query = cursor == null ? '' : `?cursor=${encodeURIComponent(cursor)}`
  return request(`/api/users/${encodeURIComponent(username)}/${kind}${query}`)
}

/**
 * U-06 アイコン画像の変更(ログイン中のユーザー自身のみ) → { avatarUrl }。パート名 avatar に画像1枚
 * @returns {Promise<AvatarResult>}
 */
export function uploadAvatar(file) {
  const form = new FormData()
  form.append('avatar', file)
  return request('/api/users/me/avatar', { method: 'POST', body: form })
}

/**
 * U-05 プロフィール更新(ログイン中のユーザー自身のみ) → Profile
 * @returns {Promise<Profile>}
 */
export function updateProfile({ displayName, bio }) {
  return request('/api/users/me', { method: 'PUT', body: { displayName, bio } })
}
