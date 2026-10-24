/** ユーザーのプロフィール(SC-06)のURL */
export const profilePath = (username) => `/users/${encodeURIComponent(username)}`

/**
 * フォロー中／フォロワー一覧(SC-08)のURL
 * @param {'following' | 'followers'} kind
 */
export const followListPath = (username, kind) => `${profilePath(username)}/${kind}`
