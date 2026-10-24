import { request } from './http.js'

/**
 * P-01 投稿作成 → Post。multipart/form-data で本文と画像(同じ名前 images で最大4つ)を送る。
 * 送った順が画像の表示順になる。
 * @param {{ content: string, images?: File[] }} post
 */
export function createPost({ content, images = [] }) {
  const form = new FormData()
  form.append('content', content)
  for (const image of images) form.append('images', image)
  return request('/api/posts', { method: 'POST', body: form })
}

/** P-02 投稿詳細 → Post */
export function getPost(postId) {
  return request(`/api/posts/${encodeURIComponent(postId)}`)
}

/** P-04 投稿編集 → Post */
export function updatePost(postId, { content }) {
  return request(`/api/posts/${encodeURIComponent(postId)}`, { method: 'PUT', body: { content } })
}

/** P-03 投稿削除 */
export function deletePost(postId) {
  return request(`/api/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' })
}

/** L-01 いいねする → { likeCount, likedByMe } */
export function likePost(postId) {
  return request(`/api/posts/${encodeURIComponent(postId)}/likes`, { method: 'POST' })
}

/** L-02 いいね取り消し → { likeCount, likedByMe } */
export function unlikePost(postId) {
  return request(`/api/posts/${encodeURIComponent(postId)}/likes`, { method: 'DELETE' })
}

/** T-01 タイムライン → { items, nextCursor, hasNext }。cursor を省略すると最新から */
export function getTimeline(cursor) {
  const query = cursor == null ? '' : `?cursor=${encodeURIComponent(cursor)}`
  return request(`/api/timeline${query}`)
}

/** T-02 新着投稿 → { items, hasMore }。since より新しい投稿 */
export function getNewPosts(since) {
  return request(`/api/timeline/new?since=${encodeURIComponent(since)}`)
}
