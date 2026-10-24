import { useEffect, useRef, useState } from 'react'
import * as postsApi from '../api/postsApi.js'
import { useAuth } from '../auth/useAuth.js'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGES, validateImageFile } from '../utils/imageUtils.js'
import { countChars, isBlank, MAX_POST_LENGTH } from '../utils/textUtils.js'
import { Avatar } from './Avatar.jsx'
import { ImagePreviewList } from './ImagePreviewList.jsx'

let nextImageId = 1

/**
 * SC-04 投稿作成モーダル(PST-01、画像は IMG-01・02)。editingPost を渡すと投稿編集(PST-04)になる。
 * 編集で変えられるのは本文だけ(画像は追加・削除できない)。
 * onSaved には保存後の投稿(APIのレスポンス)を渡す。
 */
export function PostComposerModal({ editingPost, onClose, onSaved }) {
  const { user } = useAuth()
  const initialContent = editingPost?.content ?? ''
  const [content, setContent] = useState(initialContent)
  // 添付する画像 [{ id, file, url }]。url はプレビュー用(URL.createObjectURL)
  const [images, setImages] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const remaining = MAX_POST_LENGTH - countChars(content)
  const unchanged = editingPost != null && content.trim() === initialContent
  // 画像付きなら本文は空でもよい(編集のときは、元の投稿に画像があるか)
  const hasImages = editingPost ? editingPost.images.length > 0 : images.length > 0
  const canSubmit = !submitting && (!isBlank(content) || hasImages) && remaining >= 0 && !unchanged
  const remainingImages = MAX_IMAGES - images.length

  // プレビュー用のURLは、取り消したとき・モーダルを閉じたときに解放する
  const imagesRef = useRef(images)
  useEffect(() => {
    imagesRef.current = images
  })
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)), [])

  const requestClose = () => {
    if (submitting) return
    const dirty = content !== initialContent || images.length > 0
    if (dirty && !window.confirm('入力内容を破棄しますか？')) return
    onClose()
  }
  const requestCloseRef = useRef(requestClose)
  useEffect(() => {
    requestCloseRef.current = requestClose
  })

  useEffect(() => {
    // 編集のときはカーソルを本文の最後に置く
    const textarea = textareaRef.current
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    // モーダルの後ろの画面がスクロールしないようにする
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') requestCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  /** 選んだ画像を形式・サイズ・枚数でチェックして追加する。5枚以上選んだ場合は先頭から入る分だけ追加する */
  const handleSelectImages = (e) => {
    const files = [...e.target.files]
    // 同じファイルをもう一度選べるよう、選択状態を空に戻す
    e.target.value = ''
    const added = []
    let message = ''
    for (const file of files) {
      const invalid = validateImageFile(file)
      if (invalid) {
        message = invalid
        continue
      }
      if (added.length >= remainingImages) {
        message = '画像は4枚まで添付できます'
        break
      }
      added.push({ id: nextImageId++, file, url: URL.createObjectURL(file) })
    }
    setError(message)
    if (added.length > 0) setImages((current) => [...current, ...added])
  }

  const handleRemoveImage = (id) => {
    setImages((current) => {
      const removed = current.find((image) => image.id === id)
      if (removed) URL.revokeObjectURL(removed.url)
      return current.filter((image) => image.id !== id)
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      const saved = editingPost
        ? await postsApi.updatePost(editingPost.id, { content })
        : await postsApi.createPost({ content, images: images.map((image) => image.file) })
      onSaved(saved)
    } catch (err) {
      setError(err.errors?.[0]?.message ?? err.message)
      setSubmitting(false)
    }
  }

  // Ctrl+Enter(Macは⌘+Enter)でも送信できる
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e)
  }

  const title = editingPost ? '投稿を編集' : '投稿する'

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <div className="modal__head">
          <button type="button" className="icon-btn" aria-label="閉じる" onClick={requestClose}>
            ×
          </button>
          <h2 id="composer-title" className="modal__title">
            {title}
          </h2>
        </div>
        <form className="composer" onSubmit={handleSubmit} noValidate>
          <Avatar user={user} />
          <div className="composer__body">
            <textarea
              ref={textareaRef}
              className="textarea"
              aria-label="本文"
              placeholder="いまどうしてる？"
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setError('')
              }}
              onKeyDown={handleKeyDown}
            />
            <ImagePreviewList images={images} onRemove={handleRemoveImage} disabled={submitting} />
            {error && (
              <p className="field__error" role="alert">
                {error}
              </p>
            )}
            <div className="composer__foot">
              {/* 画像は投稿するときだけ添付できる(編集では変えられない) */}
              {!editingPost && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                    multiple
                    hidden
                    onChange={handleSelectImages}
                  />
                  <button
                    type="button"
                    className="btn btn--outline composer__add-image"
                    disabled={submitting || remainingImages === 0}
                    onClick={() => fileInputRef.current.click()}
                  >
                    🖼 画像を追加{images.length > 0 && `（残り${remainingImages}枚）`}
                  </button>
                </>
              )}
              <span className={`counter${remaining < 0 ? ' is-over' : ''}`} aria-live="polite">
                残り {remaining} 文字
              </span>
              <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
                {submitting ? '送信中…' : editingPost ? '保存' : '投稿'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
