import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as usersApi from '../api/usersApi.js'

/** 新しい順(投稿IDの降順)に並べ、同じ投稿を1件にまとめる */
function mergePosts(...lists) {
  const byId = new Map()
  for (const post of lists.flat()) {
    if (!byId.has(post.id)) byId.set(post.id, post)
  }
  return [...byId.values()].sort((a, b) => b.id - a.id)
}

const INITIAL_STATE = {
  status: 'loading', // 'loading' | 'ready' | 'error'
  error: '',
  posts: [],
  nextCursor: null,
  hasNext: false,
  loadingMore: false,
  moreError: '',
}

/**
 * プロフィール(SC-06)の投稿一覧。20件ずつ新しい順に読み込む(タイムラインと同じ作り)。
 * 別のユーザーを開いたときは、呼び出し側で key を変えて作り直す。
 */
export function useUserPosts(username) {
  const [state, setState] = useState(INITIAL_STATE)
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  })
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    usersApi
      .getUserPosts(username)
      .then((page) => {
        if (cancelled) return
        setState({ ...INITIAL_STATE, status: 'ready', posts: page.items, nextCursor: page.nextCursor, hasNext: page.hasNext })
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ ...s, status: 'error', error: err.message }))
      })
    return () => {
      cancelled = true
    }
  }, [username])

  /** 次の20件 */
  const loadMore = useCallback(async () => {
    const { status, hasNext, nextCursor } = stateRef.current
    if (status !== 'ready' || !hasNext || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setState((s) => ({ ...s, loadingMore: true, moreError: '' }))
    try {
      const page = await usersApi.getUserPosts(username, nextCursor)
      setState((s) => ({
        ...s,
        posts: mergePosts(s.posts, page.items),
        nextCursor: page.nextCursor,
        hasNext: page.hasNext,
        loadingMore: false,
      }))
    } catch (err) {
      setState((s) => ({ ...s, loadingMore: false, moreError: err.message }))
    } finally {
      loadingMoreRef.current = false
    }
  }, [username])

  const updatePost = useCallback((post) => {
    setState((s) => ({ ...s, posts: s.posts.map((p) => (p.id === post.id ? post : p)) }))
  }, [])

  /** 投稿の一部(いいね数など)だけを書き換える */
  const patchPost = useCallback((postId, patch) => {
    setState((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? { ...p, ...patch } : p)) }))
  }, [])

  const removePost = useCallback((postId) => {
    setState((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== postId) }))
  }, [])

  return { ...state, loadMore, updatePost, patchPost, removePost }
}
