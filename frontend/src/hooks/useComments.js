import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as commentsApi from '../api/commentsApi.js'

/** 古い順(コメントIDの昇順)に並べ、同じコメントを1件にまとめる */
function mergeComments(...lists) {
  const byId = new Map()
  for (const comment of lists.flat()) {
    if (!byId.has(comment.id)) byId.set(comment.id, comment)
  }
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

const INITIAL_STATE = {
  status: 'loading', // 'loading' | 'ready' | 'error'
  error: '',
  comments: [],
  nextCursor: null,
  hasNext: false,
  loadingMore: false,
  moreError: '',
}

/** 1ページ目を読み込んだ直後の状態 */
const firstPageState = (page) => ({
  ...INITIAL_STATE,
  status: 'ready',
  comments: page.items,
  nextCursor: page.nextCursor,
  hasNext: page.hasNext,
})

/**
 * 投稿詳細のコメント一覧(CMT-01〜03)。20件ずつ古い順に読み込む。
 * 別の投稿を開いたときは、呼び出し側で key を変えて作り直す(前の投稿のコメントを残さないため)。
 */
export function useComments(postId) {
  const [state, setState] = useState(INITIAL_STATE)
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  })
  const loadingMoreRef = useRef(false)

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', error: '' }))
    try {
      setState(firstPageState(await commentsApi.getComments(postId)))
    } catch (err) {
      setState((s) => ({ ...s, status: 'error', error: err.message }))
    }
  }, [postId])

  useEffect(() => {
    let cancelled = false
    commentsApi
      .getComments(postId)
      .then((page) => {
        if (!cancelled) setState(firstPageState(page))
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ ...s, status: 'error', error: err.message }))
      })
    return () => {
      cancelled = true
    }
  }, [postId])

  /** 次の20件 */
  const loadMore = useCallback(async () => {
    const { status, hasNext, nextCursor } = stateRef.current
    if (status !== 'ready' || !hasNext || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setState((s) => ({ ...s, loadingMore: true, moreError: '' }))
    try {
      const page = await commentsApi.getComments(postId, nextCursor)
      setState((s) => ({
        ...s,
        comments: mergeComments(s.comments, page.items),
        nextCursor: page.nextCursor,
        hasNext: page.hasNext,
        loadingMore: false,
      }))
    } catch (err) {
      setState((s) => ({ ...s, loadingMore: false, moreError: err.message }))
    } finally {
      loadingMoreRef.current = false
    }
  }, [postId])

  /** コメントを投稿し、一覧の一番下に追加する。戻り値は最新のコメント数 */
  const addComment = useCallback(
    async (content) => {
      const { comment, commentCount } = await commentsApi.createComment(postId, content)
      setState((s) => ({ ...s, comments: mergeComments(s.comments, [comment]) }))
      return commentCount
    },
    [postId],
  )

  /** 一覧からコメントを取り除く */
  const removeComment = useCallback((commentId) => {
    setState((s) => ({ ...s, comments: s.comments.filter((c) => c.id !== commentId) }))
  }, [])

  return { ...state, reload, loadMore, addComment, removeComment }
}
