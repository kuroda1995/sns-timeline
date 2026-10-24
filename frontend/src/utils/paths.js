/** ユーザーのプロフィール(SC-06)のURL */
export const profilePath = (username) => `/users/${encodeURIComponent(username)}`
