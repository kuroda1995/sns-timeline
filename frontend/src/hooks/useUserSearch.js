import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as usersApi from '../api/usersApi.js'

const INITIAL_STATE = {
  status: 'loading', // 'loading' | 'ready' | 'error'
  error: '',
  users: [],
  page: 0,
  hasNext: false,
  // 1ページ目の時点で20件を超えていたか(見出しの「20件以上」に使う)
  moreThanFirstPage: false,
  loadingMore: false,
  moreError: '',
}

/** 同じユーザーを1人にまとめる(ページの間に新しく登録した人がいると、同じ人が次のページにも出ることがある) */
function mergeUsers(current, next) {
  const shown = new Set(current.map((u) => u.id))
  return [...current, ...next.filter((u) => !shown.has(u.id))]
}

/**
 * ユーザー検索の結果(SRCH-01)。20件ずつページ番号で読み込む(検索結果は並び順の都合でカーソル方式にできないため)。
 * キーワードが変わったときは、呼び出し側で key を変えて作り直す。
 */
export function useUserSearch(q) {
  const [state, setState] = useState(INITIAL_STATE)
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  })
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    usersApi
      .searchUsers(q)
      .then((res) => {
        if (cancelled) return
        setState({ ...INITIAL_STATE, status: 'ready', users: res.items, page: 0, hasNext: res.hasNext, moreThanFirstPage: res.hasNext })
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ ...s, status: 'error', error: err.message }))
      })
    return () => {
      cancelled = true
    }
  }, [q])

  /** 次の20件 */
  const loadMore = useCallback(async () => {
    const { status, hasNext, page } = stateRef.current
    if (status !== 'ready' || !hasNext || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setState((s) => ({ ...s, loadingMore: true, moreError: '' }))
    try {
      const res = await usersApi.searchUsers(q, page + 1)
      setState((s) => ({
        ...s,
        users: mergeUsers(s.users, res.items),
        page: res.page,
        hasNext: res.hasNext,
        loadingMore: false,
      }))
    } catch (err) {
      setState((s) => ({ ...s, loadingMore: false, moreError: err.message }))
    } finally {
      loadingMoreRef.current = false
    }
  }, [q])

  /** 一覧の中のユーザーのフォロー状態を書き換える */
  const setFollowedByMe = useCallback((userId, followedByMe) => {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, followedByMe } : u)) }))
  }, [])

  return { ...state, loadMore, setFollowedByMe }
}
