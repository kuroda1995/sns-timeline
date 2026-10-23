import { useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { countChars, isBlank, MAX_POST_LENGTH } from '../utils/textUtils.js'
import { Avatar } from './Avatar.jsx'

/**
 * コメント入力欄(CMT-01)。入力チェックは投稿と同じ(1〜140文字、空白・改行だけは不可)。
 * onSubmit(content) が成功したら入力欄を空に戻す。失敗したら入力内容を残してエラーを表示する。
 */
export function CommentForm({ onSubmit }) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const remaining = MAX_POST_LENGTH - countChars(content)
  const canSubmit = !submitting && !isBlank(content) && remaining >= 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(content)
      setContent('')
    } catch (err) {
      setError(err.errors?.[0]?.message ?? err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Ctrl+Enter(Macは⌘+Enter)でも送信できる
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e)
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit} noValidate>
      <Avatar user={user} />
      <div className="comment-form__body">
        <textarea
          className="textarea"
          aria-label="コメント"
          placeholder="コメントを書く"
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            setError('')
          }}
          onKeyDown={handleKeyDown}
        />
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <div className="comment-form__foot">
          <span className={`counter${remaining < 0 ? ' is-over' : ''}`} aria-live="polite">
            残り {remaining} 文字
          </span>
          <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
            {submitting ? '送信中…' : '送信'}
          </button>
        </div>
      </div>
    </form>
  )
}
