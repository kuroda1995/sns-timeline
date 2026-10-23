import { useEffect, useRef, useState } from 'react'

/**
 * 一覧の一番下に置いた目印の要素が画面に近づいたら onLoadMore を呼ぶ(TL-02)。
 * 戻り値を目印の要素の ref に渡す。読み込み中は enabled=false にすると監視を止め、
 * 読み込み後に監視し直したときに、まだ目印が見えていれば続けて読み込む。
 */
export function useInfiniteScroll(onLoadMore, enabled) {
  const [node, setNode] = useState(null)
  const onLoadMoreRef = useRef(onLoadMore)

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  })

  useEffect(() => {
    if (!node || !enabled) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMoreRef.current()
      },
      // 一番下に着く少し手前で読み込み始める
      { rootMargin: '0px 0px 400px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, enabled])

  return setNode
}
