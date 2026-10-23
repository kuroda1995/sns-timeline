import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import * as postsApi from '../api/postsApi.js'

/** 新しい順(投稿IDの降順)に並べ、同じ投稿を1件にまとめる */
function mergePosts(...lists) {
  const byId = new Map()
  for (const post of lists.flat()) {
    if (!byId.has(post.id)) byId.set(post.id, post)
  }
  return [...byId.values()].sort((a, b) => b.id - a.id)
}

const maxId = (posts, fallback) => posts.reduce((max, p) => Math.max(max, p.id), fallback)

const INITIAL_STATE = {
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  error: '',
  posts: [],
  nextCursor: null,
  hasNext: false,
  loadingMore: false,
  moreError: '',
  // TL-05: 届いたがまだ一覧に入れていない新着投稿(新しい順)
  pending: [],
  // 新着が20件を超えて溜まっている(入れるときはタイムラインを読み込み直す)
  pendingHasMore: false,
}

/**
 * タイムライン(TL-01〜05)の状態。投稿詳細へ移動して戻ってきても一覧とスクロール位置を保てるよう、
 * 画面(TimelinePage)ではなくログイン後の共通レイアウト(AppLayout)で持つ。
 */
export function useTimeline() {
  const [state, setState] = useState(INITIAL_STATE)
  // 関数(loadMore など)を作り直さずに最新の状態を読むための参照
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  })

  // 読み込み直したら、それより前に出したリクエストの結果は捨てる
  const generationRef = useRef(0)
  // サーバーから受け取った中で一番新しい投稿ID(T-02 の since)。
  // 自分の投稿は一覧に先に入れるが、ここは進めない(その間に届いた他人の投稿を取りこぼさないため)
  const latestSeenIdRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const checkingRef = useRef(false)
  // 投稿詳細へ移動する前のスクロール位置(「戻る」で戻ってきたときに復元する)
  const scrollYRef = useRef(0)

  const reload = useCallback(async () => {
    const generation = ++generationRef.current
    loadingMoreRef.current = false
    setState((s) => ({ ...s, status: 'loading', error: '' }))
    try {
      const page = await postsApi.getTimeline()
      if (generation !== generationRef.current) return
      latestSeenIdRef.current = maxId(page.items, 0)
      setState({
        ...INITIAL_STATE,
        status: 'ready',
        posts: page.items,
        nextCursor: page.nextCursor,
        hasNext: page.hasNext,
      })
    } catch (err) {
      if (generation !== generationRef.current) return
      setState((s) => ({ ...s, status: 'error', error: err.message }))
    }
  }, [])

  /** TL-02 次の20件 */
  const loadMore = useCallback(async () => {
    const { status, hasNext, nextCursor } = stateRef.current
    if (status !== 'ready' || !hasNext || loadingMoreRef.current) return
    const generation = generationRef.current
    loadingMoreRef.current = true
    setState((s) => ({ ...s, loadingMore: true, moreError: '' }))
    try {
      const page = await postsApi.getTimeline(nextCursor)
      if (generation !== generationRef.current) return
      setState((s) => ({
        ...s,
        posts: mergePosts(s.posts, page.items),
        nextCursor: page.nextCursor,
        hasNext: page.hasNext,
        loadingMore: false,
      }))
    } catch (err) {
      if (generation !== generationRef.current) return
      setState((s) => ({ ...s, loadingMore: false, moreError: err.message }))
    } finally {
      if (generation === generationRef.current) loadingMoreRef.current = false
    }
  }, [])

  /** TL-05 新着投稿があるか確認し、あれば pending に溜める */
  const checkNew = useCallback(async () => {
    if (stateRef.current.status !== 'ready' || checkingRef.current) return
    const generation = generationRef.current
    checkingRef.current = true
    try {
      const { items, hasMore } = await postsApi.getNewPosts(latestSeenIdRef.current)
      if (generation !== generationRef.current) return
      latestSeenIdRef.current = maxId(items, latestSeenIdRef.current)
      if (items.length === 0 && !hasMore) return
      setState((s) => {
        const shown = new Set(s.posts.map((p) => p.id))
        // 自分がこのタブで投稿したもの(すでに一覧にある)は数えない
        const fresh = items.filter((p) => !shown.has(p.id))
        if (fresh.length === 0 && !hasMore) return s
        return {
          ...s,
          pending: mergePosts(fresh, s.pending),
          pendingHasMore: s.pendingHasMore || hasMore,
        }
      })
    } catch {
      // 定期確認の失敗は画面に出さず、次の確認で取り直す
    } finally {
      checkingRef.current = false
    }
  }, [])

  /** 溜まっている新着を一覧の一番上に入れる */
  const flushPending = useCallback(() => {
    const { pending, pendingHasMore } = stateRef.current
    if (pendingHasMore) {
      reload()
      return
    }
    if (pending.length === 0) return
    setState((s) => ({ ...s, posts: mergePosts(s.pending, s.posts), pending: [] }))
  }, [reload])

  /** 自分が投稿したものは、APIを呼び直さずに一番上に入れる */
  const prependPost = useCallback((post) => {
    setState((s) => ({
      ...s,
      posts: mergePosts([post], s.posts),
      pending: s.pending.filter((p) => p.id !== post.id),
    }))
  }, [])

  const updatePost = useCallback((post) => {
    const replace = (posts) => posts.map((p) => (p.id === post.id ? post : p))
    setState((s) => ({ ...s, posts: replace(s.posts), pending: replace(s.pending) }))
  }, [])

  /** 投稿の一部(いいね数など)だけを書き換える。一覧に無い投稿なら何もしない */
  const patchPost = useCallback((postId, patch) => {
    const apply = (posts) => posts.map((p) => (p.id === postId ? { ...p, ...patch } : p))
    setState((s) => ({ ...s, posts: apply(s.posts), pending: apply(s.pending) }))
  }, [])

  const removePost = useCallback((postId) => {
    const remove = (posts) => posts.filter((p) => p.id !== postId)
    setState((s) => ({ ...s, posts: remove(s.posts), pending: remove(s.pending) }))
  }, [])

  return {
    ...state,
    scrollYRef,
    reload,
    loadMore,
    checkNew,
    flushPending,
    prependPost,
    updatePost,
    patchPost,
    removePost,
  }
}
