import { request } from './http.js'

/** C-01 コメント一覧 → { items, nextCursor, hasNext }。古い順。cursor を省略すると最初から */
export function getComments(postId, cursor) {
  const query = cursor == null ? '' : `?cursor=${encodeURIComponent(cursor)}`
  return request(`/api/posts/${encodeURIComponent(postId)}/comments${query}`)
}

/** C-02 コメント投稿 → { comment, commentCount } */
export function createComment(postId, content) {
  return request(`/api/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: { content } })
}

/** C-03 コメント削除(本人のみ) → { commentCount } */
export function deleteComment(commentId) {
  return request(`/api/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' })
}
