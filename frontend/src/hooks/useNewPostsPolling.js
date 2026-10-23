import { useEffect } from 'react'

/** 新着投稿を確認する間隔(TL-05) */
export const NEW_POSTS_INTERVAL_MS = 15_000

/** この位置より上にいれば「一番上を見ている」とみなす */
const AT_TOP_PX = 80

const isPageVisible = () => document.visibilityState === 'visible'
const isAtTop = () => window.scrollY <= AT_TOP_PX

/**
 * TL-05 新着投稿のお知らせ。
 * ・15秒ごとに新着を確認する。別のタブを見ている間は確認せず、戻ってきたらすぐ確認する
 * ・一番上を見ているときは、届いた新着をそのまま一覧に入れる
 * ・スクロールして読んでいる途中は入れずに溜めておき、一番上まで戻ったときに入れる
 *   (それまでは画面に「新しい投稿 N件」ボタンを出す)
 */
export function useNewPostsPolling({ enabled, hasPending, checkNew, flushPending }) {
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      if (isPageVisible()) checkNew()
    }, NEW_POSTS_INTERVAL_MS)
    const handleVisibilityChange = () => {
      if (isPageVisible()) checkNew()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, checkNew])

  useEffect(() => {
    if (!enabled || !hasPending) return
    if (isAtTop()) {
      flushPending()
      return
    }
    const handleScroll = () => {
      if (isAtTop()) flushPending()
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [enabled, hasPending, flushPending])
}
