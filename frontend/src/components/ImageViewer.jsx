import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * 画像の拡大表示(IMG-04)。× ・背景・Escキーで閉じる。複数枚なら ‹ › ボタンと左右キーで切り替える。
 * 投稿カードの中(押すと投稿詳細へ移動する場所)に置かれるため、画面全体の一番外側に表示し、クリックも外に伝えない。
 */
export function ImageViewer({ images, index, onChangeIndex, onClose }) {
  const closeRef = useRef(null)
  const hasMany = images.length > 1
  const prev = () => onChangeIndex((index - 1 + images.length) % images.length)
  const next = () => onChangeIndex((index + 1) % images.length)

  // キー操作は最新の index で動くよう、関数を参照で持つ
  const keyHandlerRef = useRef(null)
  useEffect(() => {
    keyHandlerRef.current = (e) => {
      if (e.key === 'Escape') onClose()
      else if (hasMany && e.key === 'ArrowLeft') prev()
      else if (hasMany && e.key === 'ArrowRight') next()
    }
  })

  useEffect(() => {
    closeRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (e) => keyHandlerRef.current(e)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return createPortal(
    <div
      className="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`画像 ${index + 1}/${images.length}`}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <button ref={closeRef} type="button" className="image-viewer__close" aria-label="閉じる" onClick={onClose}>
        ×
      </button>
      {hasMany && (
        <button type="button" className="image-viewer__nav image-viewer__nav--prev" aria-label="前の画像" onClick={prev}>
          ‹
        </button>
      )}
      <img className="image-viewer__img" src={images[index].url} alt={`画像 ${index + 1}枚目`} />
      {hasMany && (
        <button type="button" className="image-viewer__nav image-viewer__nav--next" aria-label="次の画像" onClick={next}>
          ›
        </button>
      )}
    </div>,
    document.body,
  )
}
