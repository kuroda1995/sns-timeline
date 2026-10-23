import { request } from './http.js'

/** P-01 投稿作成 → Post。画像を添付できるよう multipart/form-data で送る */
export function createPost({ content }) {
  const form = new FormData()
  form.append('content', content)
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

/** T-01 タイムライン → { items, nextCursor, hasNext }。cursor を省略すると最新から */
export function getTimeline(cursor) {
  const query = cursor == null ? '' : `?cursor=${encodeURIComponent(cursor)}`
  return request(`/api/timeline${query}`)
}

/** T-02 新着投稿 → { items, hasMore }。since より新しい投稿 */
export function getNewPosts(since) {
  return request(`/api/timeline/new?since=${encodeURIComponent(since)}`)
}
