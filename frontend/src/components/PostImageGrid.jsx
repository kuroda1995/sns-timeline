import { useState } from 'react'
import { ImageViewer } from './ImageViewer.jsx'

/**
 * 投稿カードの中の画像(IMG-03)。枚数に応じて並べ方を変える(1枚／左右2枚／左に大きく1枚＋右に上下2枚／2×2)。
 * 画像は枠に合わせて切り抜いて表示し、押すと大きく表示する(IMG-04)。
 * images は表示順(sortOrder)に並んだ [{ url, sortOrder }]。
 */
export function PostImageGrid({ images }) {
  // 拡大表示している画像の番号(0始まり)。null なら閉じている
  const [openIndex, setOpenIndex] = useState(null)
  if (!images || images.length === 0) return null

  return (
    <>
      <div className={`image-grid image-grid--${images.length}`}>
        {images.map((image, i) => (
          <button
            key={image.url}
            type="button"
            className="image-grid__item"
            aria-label={`画像 ${i + 1}枚目を大きく表示`}
            onClick={() => setOpenIndex(i)}
          >
            <img src={image.url} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {openIndex != null && (
        <ImageViewer images={images} index={openIndex} onChangeIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  )
}
