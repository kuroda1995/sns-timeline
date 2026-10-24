/**
 * 投稿前の画像のプレビュー(IMG-02)。各画像の × で取り消せる。
 * images は [{ id, url }]。url は URL.createObjectURL で作ったもので、解放は呼び出し側で行う。
 */
export function ImagePreviewList({ images, onRemove, disabled }) {
  if (images.length === 0) return null
  return (
    <ul className="image-previews" aria-label="添付する画像">
      {images.map((image, i) => (
        <li key={image.id} className="image-previews__item">
          <img src={image.url} alt={`添付する画像 ${i + 1}枚目`} />
          <button
            type="button"
            className="image-previews__remove"
            aria-label={`${i + 1}枚目の画像を取り消す`}
            disabled={disabled}
            onClick={() => onRemove(image.id)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
