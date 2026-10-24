import { useState } from 'react'
import { useNavigate } from 'react-router'
import * as usersApi from '../api/usersApi.js'
import { useAuth } from '../auth/useAuth.js'
import { Avatar } from '../components/Avatar.jsx'
import { FormField } from '../components/FormField.jsx'
import { useAppLayout } from '../layout/useAppLayout.js'
import { profilePath } from '../utils/paths.js'
import { countChars, isBlank } from '../utils/textUtils.js'

const MAX_DISPLAY_NAME_LENGTH = 50
const MAX_BIO_LENGTH = 160

/**
 * SC-07 プロフィール編集(USER-02)。表示名と自己紹介を変更する。
 * アイコン画像の変更(U-06)は画像投稿機能で、投稿画像と同じ保存の仕組みを作るときに追加する。
 */
export function ProfileEditPage() {
  const { user, updateUser } = useAuth()
  const { timeline } = useAppLayout()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [bio, setBio] = useState(user.bio ?? '')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const changed = displayName.trim() !== user.displayName || bio.trim() !== (user.bio ?? '')
  const displayNameError =
    errors.displayName ??
    (countChars(displayName.trim()) > MAX_DISPLAY_NAME_LENGTH ? '50文字以内で入力してください' : '')
  const bioLength = countChars(bio)
  const canSave =
    !saving && changed && !isBlank(displayName) && !displayNameError && countChars(bio.trim()) <= MAX_BIO_LENGTH

  // 入力し直したら、その項目と画面全体のエラーを消す
  const clearError = (field) => setErrors((e) => ({ ...e, [field]: undefined, form: undefined }))

  const close = () => {
    if (saving) return
    // 変更中に × を押したら確認する
    if (changed && !window.confirm('変更を破棄しますか？')) return
    navigate(profilePath(user.username))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setErrors({})
    try {
      const profile = await usersApi.updateProfile({ displayName, bio })
      // サイドメニューの表示名と、読み込み済みのタイムラインの表示名を新しくする
      updateUser({ displayName: profile.displayName, bio: profile.bio })
      timeline.invalidate()
      navigate(profilePath(user.username), { replace: true })
    } catch (err) {
      const fieldErrors = Object.fromEntries((err.errors ?? []).map((fe) => [fe.field, fe.message]))
      setErrors(Object.keys(fieldErrors).length > 0 ? fieldErrors : { form: err.message })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <header className="page-header">
        <button type="button" className="icon-btn" aria-label="閉じる" onClick={close}>
          ×
        </button>
        <h1>プロフィール編集</h1>
        <button type="submit" className="btn btn--primary page-header__action" disabled={!canSave}>
          {saving ? '保存中…' : '保存'}
        </button>
      </header>

      <div className="profile-edit">
        <div className="profile-edit__avatar">
          <Avatar user={{ ...user, displayName: displayName.trim() || user.displayName }} size="large" />
          <p className="field__hint">アイコン画像の変更は、画像投稿機能の追加後に使えるようになります</p>
        </div>

        {errors.form && (
          <p className="field__error" role="alert">
            {errors.form}
          </p>
        )}

        <FormField
          id="displayName"
          label="表示名"
          value={displayName}
          error={displayNameError}
          onChange={(e) => {
            setDisplayName(e.target.value)
            clearError('displayName')
          }}
        />

        <div className="field">
          <div className="profile-edit__label">
            <label htmlFor="bio">自己紹介</label>
            <span className={`counter${bioLength > MAX_BIO_LENGTH ? ' is-over' : ''}`} aria-live="polite">
              {bioLength}/{MAX_BIO_LENGTH}
            </span>
          </div>
          <textarea
            id="bio"
            className={`textarea${errors.bio ? ' is-invalid' : ''}`}
            value={bio}
            aria-invalid={errors.bio ? 'true' : undefined}
            onChange={(e) => {
              setBio(e.target.value)
              clearError('bio')
            }}
          />
          {errors.bio && <p className="field__error">{errors.bio}</p>}
        </div>
      </div>
    </form>
  )
}
