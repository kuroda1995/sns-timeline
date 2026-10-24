import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as usersApi from '../api/usersApi.js'

const INITIAL_STATE = {
  status: 'loading', // 'loading' | 'ready' | 'error'
  error: '',
  users: [],
  nextCursor: null,
  hasNext: false,
  loadingMore: false,
  moreError: '',
}

/**
 * フォロー中／フォロワー一覧(FLW-04)。フォローした日時が新しい順に20件ずつ読み込む。
 * ユーザーやタブ(kind)が変わったときは、呼び出し側で key を変えて作り直す。
 * @param {'following' | 'followers'} kind
 */
export function useFollowList(username, kind) {
  const [state, setState] = useState(INITIAL_STATE)
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  })
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    usersApi
      .getFollowList(username, kind)
      .then((page) => {
        if (cancelled) return
        setState({ ...INITIAL_STATE, status: 'ready', users: page.items, nextCursor: page.nextCursor, hasNext: page.hasNext })
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ ...s, status: 'error', error: err.message }))
      })
    return () => {
      cancelled = true
    }
  }, [username, kind])

  /** 次の20件 */
  const loadMore = useCallback(async () => {
    const { status, hasNext, nextCursor } = stateRef.current
    if (status !== 'ready' || !hasNext || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setState((s) => ({ ...s, loadingMore: true, moreError: '' }))
    try {
      const page = await usersApi.getFollowList(username, kind, nextCursor)
      setState((s) => {
        // 読み込みの間にフォローし直した人が、もう一度出てこないようにする
        const shown = new Set(s.users.map((u) => u.id))
        return {
          ...s,
          users: [...s.users, ...page.items.filter((u) => !shown.has(u.id))],
          nextCursor: page.nextCursor,
          hasNext: page.hasNext,
          loadingMore: false,
        }
      })
    } catch (err) {
      setState((s) => ({ ...s, loadingMore: false, moreError: err.message }))
    } finally {
      loadingMoreRef.current = false
    }
  }, [username, kind])

  /** 一覧の中のユーザーのフォロー状態を書き換える(一覧からは消さない) */
  const setFollowedByMe = useCallback((userId, followedByMe) => {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, followedByMe } : u)) }))
  }, [])

  return { ...state, loadMore, setFollowedByMe }
}
